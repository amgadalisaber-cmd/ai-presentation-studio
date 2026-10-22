import { GoogleGenAI } from "@google/genai";

export const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";

export function imageProviderStatus() {
  const key = process.env.GEMINI_API_KEY?.trim();
  return { configured: !!key, provider: "Nano Banana Pro (Gemini image model via Google GenAI API)", model: process.env.NANO_BANANA_MODEL || DEFAULT_IMAGE_MODEL, textModel: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash", keyHint: key ? `${key.slice(0, 4)}…${key.slice(-3)}` : null };
}

export class ImageProviderNotConfigured extends Error { constructor() { super("Nano Banana Pro is not configured. Set GEMINI_API_KEY on the server (see Settings & Integrations)."); } }

function client() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new ImageProviderNotConfigured();
  return new GoogleGenAI({ apiKey: key });
}

export async function generateImage(prompt: string, aspect: "16:9" | "4:3" | "1:1" | "3:4" = "16:9"): Promise<{ data: Buffer; mime: string; model: string }> {
  const ai = client();
  const model = process.env.NANO_BANANA_MODEL || DEFAULT_IMAGE_MODEL;
  const attempt = async (modalities: string[]) => ai.models.generateContent({
    model, contents: prompt,
    config: { responseModalities: modalities, imageConfig: { aspectRatio: aspect, ...(model.includes("3-pro") ? { imageSize: "2K" } : {}) } } as never,
  });
  let res;
  try { res = await attempt(["IMAGE"]); }
  catch (e) { const msg = String((e as Error).message || e); if (/modalit|INVALID_ARGUMENT|imageSize/i.test(msg)) res = await attempt(["TEXT", "IMAGE"]); else throw e; }
  const parts = res.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
    if (inline?.data) return { data: Buffer.from(inline.data, "base64"), mime: inline.mimeType || "image/png", model };
  }
  const textPart = parts.map((p) => (p as { text?: string }).text).filter(Boolean).join(" ");
  const block = res.promptFeedback?.blockReason || res.candidates?.[0]?.finishReason;
  throw new Error(`No image returned by ${model}${block ? ` (${block})` : ""}${textPart ? `: ${textPart.slice(0, 200)}` : ""}`);
}

/** Text-model helper used for structure-only planning. Never used to rewrite content. */
export async function generateJson<T>(prompt: string, schemaHint: string): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const res = await ai.models.generateContent({ model, contents: `${prompt}\n\nRespond with JSON only matching: ${schemaHint}`, config: { responseMimeType: "application/json", temperature: 0.3 } });
  const txt = res.text;
  if (!txt) return null;
  try { return JSON.parse(txt) as T; } catch { return null; }
}
