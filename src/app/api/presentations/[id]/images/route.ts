import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { imageProviderStatus } from "@/lib/images/nanobanana";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => { await ownPresentation(userId, id); return { provider: imageProviderStatus(), images: await prisma.generatedImage.findMany({ where: { presentationId: id }, orderBy: { createdAt: "asc" }, include: { slide: { select: { id: true, index: true, purpose: true } } } }) }; });
