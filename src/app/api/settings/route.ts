import { z } from "zod";
import { handler, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { imageProviderStatus } from "@/lib/images/nanobanana";
import { availableFonts } from "@/lib/render/fonts";
import { chromiumPath } from "@/lib/export/browser";
import { STORAGE_DIR } from "@/lib/storage";
import { PRESENTATION_TYPES } from "@/lib/generation/types";

export const GET = handler(async (_req, _p, userId) => {
  const rows = await prisma.userSetting.findMany({ where: { userId } });
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { settings, customTypes: (settings.customTypes as string[]) || [], defaultTypes: PRESENTATION_TYPES, integrations: { images: imageProviderStatus(), chromium: chromiumPath(), storageDir: STORAGE_DIR, fonts: await availableFonts(), database: !!process.env.DATABASE_URL } };
});
export const PATCH = handler(async (req, _p, userId) => {
  const body = await parse(req, z.object({ customTypes: z.array(z.string().min(1)).optional(), defaults: z.record(z.any()).optional() }));
  for (const [key, value] of Object.entries(body)) if (value !== undefined) await prisma.userSetting.upsert({ where: { userId_key: { userId, key } }, update: { value: value as object }, create: { userId, key, value: value as object } });
  return { ok: true };
});
