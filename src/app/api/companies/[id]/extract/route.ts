export const maxDuration = 300;
import { handler, ownCompany } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { buildKit } from "@/lib/brand/extract";
import { imageDimensions, saveFile } from "@/lib/storage";
import type { Prisma } from "@prisma/client";

/**
 * Builds the brand automatically from uploaded files (guidelines PDF/DOCX/PPTX, logos, images) and/or a website,
 * then APPLIES the result to the profile: logos become assets, colors/fonts/rules/description are filled in.
 * Everything applied can be changed or removed afterwards in the profile.
 */
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  const c = await ownCompany(userId, id);
  const form = await req.formData();
  const website = form.get("website") ? String(form.get("website")) : undefined;
  const files: { name: string; mime: string; data: Buffer }[] = [];
  for (const f of form.getAll("files")) if (f instanceof File && f.size > 0) { if (f.size > 40 * 1024 * 1024) throw new ApiError(413, `${f.name} exceeds 40 MB`); files.push({ name: f.name, mime: f.type, data: Buffer.from(await f.arrayBuffer()) }); }
  if (!files.length && !website) throw new ApiError(400, "Upload at least one file or enter a website");
  const kit = await buildKit(files, website);
  const applied: string[] = [];
  // 1. logos → assets (first one becomes primary logo if the brand has none)
  const hasPrimary = !!(await prisma.brandAsset.findFirst({ where: { companyId: id, kind: "primary_logo" } }));
  let first = !hasPrimary;
  for (const l of kit.logos) {
    if (!l.data) continue;
    const storagePath = await saveFile("uploads", l.data, l.fileName);
    const dims = imageDimensions(l.data, l.mime);
    await prisma.brandAsset.create({ data: { userId, companyId: id, kind: first ? "primary_logo" : "logo_variation", name: l.fileName, fileName: l.fileName, mimeType: l.mime, size: l.data.length, storagePath, width: dims?.width, height: dims?.height, notes: `auto-extracted (${l.source})` } });
    applied.push(`${first ? "Primary logo" : "Logo variation"}: ${l.fileName}`); first = false;
  }
  // 2. colors (append new ones), fonts (fill empty), text fields (fill empty), rules (append)
  const existingColors = (Array.isArray(c.colors) ? c.colors : []) as { hex: string; name?: string; role?: string }[];
  const newColors = kit.colors.filter((k) => !existingColors.some((e) => e.hex.toLowerCase() === k.hex.toLowerCase())).map(({ hex, name, role }) => ({ hex, name, role: existingColors.some((e) => e.role === role) ? undefined : role }));
  const typo = (c.typography && typeof c.typography === "object" ? c.typography : {}) as Record<string, string>;
  const typography = { ...typo };
  for (const [k, v] of [["headingFont", kit.fonts.heading], ["bodyFont", kit.fonts.body], ["arabicHeadingFont", kit.fonts.arabicHeading], ["arabicBodyFont", kit.fonts.arabicBody]] as const) if (v && !typography[k]) { typography[k] = v; applied.push(`${k.replace("Font", " font")}: ${v}`); }
  const data: Prisma.CompanyUpdateInput = { colors: [...existingColors, ...newColors] as Prisma.InputJsonValue, typography: typography as Prisma.InputJsonValue };
  if (kit.website && !c.website) { data.website = kit.website; applied.push("website"); }
  const about = [kit.description, kit.positioning, kit.personality ? `Personality: ${kit.personality}` : "", kit.targetAudience ? `Audience: ${kit.targetAudience}` : ""].filter(Boolean).join("\n");
  if (about && !c.description) { data.description = about.slice(0, 2000); applied.push("About this brand: filled from the documents"); }
  if (newColors.length) applied.push(`${newColors.length} color(s): ${newColors.map((x) => x.hex).join(", ")}`);
  await prisma.company.update({ where: { id }, data });
  let rulesAdded = 0;
  for (const r of kit.rules.slice(0, 25)) { const dup = await prisma.brandGuideline.findFirst({ where: { companyId: id, rule: r.rule } }); if (!dup) { await prisma.brandGuideline.create({ data: { companyId: id, category: r.category, rule: r.rule } }); rulesAdded++; } }
  if (rulesAdded) applied.push(`${rulesAdded} brand rule(s)`);
  return { applied, notes: kit.notes, summary: { colors: kit.colors.length, logos: kit.logos.length, rules: kit.rules.length, fonts: kit.fonts } };
});
