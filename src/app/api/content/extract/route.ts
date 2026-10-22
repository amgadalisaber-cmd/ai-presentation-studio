import { handler } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { extractText } from "@/lib/content/extract";
import { detectPresentationLanguage, parseContent } from "@/lib/content/parser";
export const POST = handler(async (req) => {
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "A file is required");
  if (file.size > 20 * 1024 * 1024) throw new ApiError(413, "Document exceeds 20 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const { text, warnings } = await extractText(buf, file.name, file.type);
    return { text, warnings, language: detectPresentationLanguage(text), blocks: parseContent(text).length };
  } catch (e) { throw new ApiError(415, (e as Error).message); }
});
