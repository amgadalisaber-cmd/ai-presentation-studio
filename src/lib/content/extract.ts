import mammoth from "mammoth";
import path from "path";
import os from "os";

export interface Extracted { text: string; warnings: string[]; method: "docx" | "text" | "pdf" | "pptx" | "ocr-gemini" | "ocr-tesseract" | "csv" }

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"];

/** Extracts plain text from supported documents, preserving paragraph breaks. Never rewrites the text. */
export async function extractText(buf: Buffer, fileName: string, mime: string): Promise<Extracted> {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const warnings: string[] = [];
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const res = await mammoth.extractRawText({ buffer: buf });
    for (const m of res.messages) warnings.push(m.message);
    return { text: res.value.replace(/\n{3,}/g, "\n\n").trim(), warnings, method: "docx" };
  }
  if (ext === "doc") throw new Error("Legacy .doc files are not supported. Save the file as .docx (Word → Save As) and upload again.");
  if (ext === "pdf" || mime === "application/pdf") {
    const text = await pdfText(buf);
    if (text.replace(/\s+/g, "").length > 20) return { text, warnings, method: "pdf" };
    warnings.push("The PDF has no text layer (scanned document); text was recognised with OCR — please review it before generating.");
    const ocr = await ocrImage(buf, "application/pdf");
    return { text: ocr.text, warnings: [...warnings, ...ocr.warnings], method: ocr.method };
  }
  if (ext === "pptx" || mime.includes("presentationml")) return { text: await pptxText(buf), warnings, method: "pptx" };
  if (ext === "csv" || mime === "text/csv") return { text: buf.toString("utf8").replace(/\r\n?/g, "\n").split("\n").map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "").trim()).filter(Boolean).join(" — ")).join("\n").trim(), warnings, method: "csv" };
  if (ext === "txt" || ext === "md" || ext === "markdown" || ext === "rtf" || mime.startsWith("text/")) {
    let text = buf.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (ext === "rtf") { text = text.replace(/\\par[d]?/g, "\n").replace(/\{\\[^{}]*\}|\\[a-z]+-?\d* ?|[{}]/g, ""); warnings.push("RTF formatting was stripped; please review the text."); }
    return { text: text.trim(), warnings, method: "text" };
  }
  if (IMAGE_EXT.includes(ext) || mime.startsWith("image/")) {
    warnings.push("Text was recognised from an image with OCR — please review it before generating (OCR can misread characters).");
    const ocr = await ocrImage(buf, mime || `image/${ext === "jpg" ? "jpeg" : ext}`);
    return { text: ocr.text, warnings: [...warnings, ...ocr.warnings], method: ocr.method };
  }
  throw new Error(`Unsupported document format: .${ext}. Supported: PDF, Word (.docx), PowerPoint (.pptx), text (.txt, .md, .rtf, .csv) and images (PNG, JPG, WEBP).`);
}

export async function pdfText(buf: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default as unknown as (b: Buffer) => Promise<{ text: string }>;
  const res = await pdfParse(buf);
  // pdf-parse separates pages with form feeds; normalise to blank lines and collapse hard-wrapped lines inside paragraphs
  return res.text.replace(/\f/g, "\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function pptxText(buf: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const f of slides) {
    const xml = await zip.file(f)!.async("string");
    const paragraphs = [...xml.matchAll(/<a:p>(.*?)<\/a:p>/gs)].map((m) => [...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => decodeXml(t[1])).join("")).filter((t) => t.trim());
    if (paragraphs.length) out.push(paragraphs.join("\n"));
  }
  return out.join("\n\n").trim();
}
function decodeXml(s: string) { return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }

/** OCR: Gemini (best for Arabic and layout) when configured, otherwise Tesseract (English + Arabic). */
export async function ocrImage(buf: Buffer, mime: string): Promise<{ text: string; warnings: string[]; method: "ocr-gemini" | "ocr-tesseract" }> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const res = await ai.models.generateContent({ model: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash", contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: buf.toString("base64") } }, { text: "Transcribe ALL text in this document exactly as written, in reading order. Keep the original language (Arabic stays Arabic, English stays English), spelling, numbers and punctuation. Separate paragraphs with a blank line; keep bullet points as lines starting with '- '. Do not translate, summarise, correct or add anything. Output only the text." }] }], config: { temperature: 0 } });
      const text = (res.text || "").trim();
      if (text) return { text, warnings: [], method: "ocr-gemini" };
    } catch (e) { console.warn("[ocr] Gemini OCR failed, falling back to Tesseract:", (e as Error).message); }
  }
  if (mime === "application/pdf") throw new Error("This PDF is scanned (no text layer). Set GEMINI_API_KEY to enable OCR for PDFs, or upload the pages as images.");
  const { createWorker } = await import("tesseract.js");
  // Language data is bundled in public/tessdata (fast models, English + Arabic) so OCR works offline and on serverless hosts.
  const localLang = path.join(process.cwd(), "public", "tessdata");
  const langPath = (await import("fs")).existsSync(path.join(localLang, "eng.traineddata.gz")) ? localLang : "https://tessdata.projectnaptha.com/4.0.0";
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await new Promise<Awaited<ReturnType<typeof createWorker>>>((resolve, reject) => {
      createWorker(["eng", "ara"], 1, { langPath, gzip: true, cachePath: path.join(os.tmpdir(), "tessdata"), logger: () => {}, errorHandler: (e: unknown) => reject(new Error(`OCR engine error: ${(e as Error)?.message || e}`)) }).then(resolve, reject);
    });
    const { data } = await worker.recognize(buf);
    return { text: data.text.replace(/\n{3,}/g, "\n\n").trim(), warnings: ["OCR by Tesseract (set GEMINI_API_KEY for higher-quality Arabic OCR)."], method: "ocr-tesseract" };
  } catch (e) { throw new Error(`Could not read text from the image: ${(e as Error).message}. Try a sharper image, or set GEMINI_API_KEY for AI OCR.`); }
  finally { try { await worker?.terminate(); } catch { /* ignore */ } }
}
