import { handler, ownCompany } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { ALLOWED_DOC_TYPES, ALLOWED_IMAGE_TYPES, imageDimensions, saveFile } from "@/lib/storage";

const KINDS = ["primary_logo", "secondary_logo", "logo_variation", "icon", "product_image", "photo", "reference_presentation", "guideline_doc", "font", "document", "style_reference", "other"];
const MAX = 50 * 1024 * 1024;

export const GET = handler(async (req, _p, userId) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId"); const kind = url.searchParams.get("kind"); const q = url.searchParams.get("q");
  return prisma.brandAsset.findMany({ where: { userId, ...(companyId ? { companyId } : {}), ...(kind ? { kind } : {}), ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) }, orderBy: { createdAt: "desc" }, include: { company: { select: { id: true, name: true } } }, take: 500 });
});

export const POST = handler(async (req, _p, userId) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "A file is required");
  if (file.size > MAX) throw new ApiError(413, "File exceeds 50 MB");
  const kind = String(form.get("kind") || "other");
  if (!KINDS.includes(kind)) throw new ApiError(400, `Unsupported asset kind "${kind}"`);
  const companyId = form.get("companyId") ? String(form.get("companyId")) : null;
  if (companyId) await ownCompany(userId, companyId);
  const mime = file.type || "application/octet-stream";
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const isImage = ALLOWED_IMAGE_TYPES.includes(mime) || ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext);
  const isDoc = ALLOWED_DOC_TYPES.includes(mime) || ["pdf", "pptx", "docx", "txt", "md", "ttf", "otf", "woff", "woff2"].includes(ext);
  if (!isImage && !isDoc) throw new ApiError(415, `Unsupported file type (${mime || ext}). Allowed: PNG, JPG, WEBP, SVG, GIF, PDF, PPTX, DOCX, TXT, MD, TTF, OTF.`);
  if (["primary_logo", "secondary_logo", "logo_variation", "icon", "product_image", "photo", "style_reference"].includes(kind) && !isImage) throw new ApiError(415, "This asset kind requires an image file.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new ApiError(400, "The uploaded file is empty");
  const dims = isImage ? imageDimensions(buf, mime) : null;
  if (isImage && mime !== "image/svg+xml" && !dims && !["gif"].includes(ext)) {
    // Validate that the bytes are really an image when dimensions couldn't be read
    const sig = buf.subarray(0, 4).toString("hex");
    if (!/^(89504e47|ffd8ff|52494646|47494638)/.test(sig)) throw new ApiError(415, "The file does not look like a valid image.");
  }
  const storagePath = await saveFile("uploads", buf, file.name);
  return prisma.brandAsset.create({ data: { userId, companyId, kind, name: String(form.get("name") || file.name), fileName: file.name, mimeType: mime, size: buf.length, storagePath, width: dims?.width, height: dims?.height, notes: form.get("notes") ? String(form.get("notes")) : null, approved: form.get("approved") !== "false" } });
});
