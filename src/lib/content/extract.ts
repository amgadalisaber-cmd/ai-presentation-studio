import mammoth from "mammoth";

/** Extracts plain text from supported documents, preserving paragraph breaks. */
export async function extractText(buf: Buffer, fileName: string, mime: string): Promise<{ text: string; warnings: string[] }> {
  const ext = fileName.toLowerCase().split(".").pop();
  const warnings: string[] = [];
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    const res = await mammoth.extractRawText({ buffer: buf });
    for (const m of res.messages) warnings.push(m.message);
    return { text: res.value.replace(/\n{3,}/g, "\n\n"), warnings };
  }
  if (ext === "txt" || ext === "md" || ext === "markdown" || mime.startsWith("text/")) {
    let text = buf.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { text, warnings };
  }
  throw new Error(`Unsupported document format: .${ext}. Supported: .txt, .md, .docx`);
}
