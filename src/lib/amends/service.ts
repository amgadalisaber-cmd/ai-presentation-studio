import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import { loadSlides, loadBlocks, saveSlides, replaceOneSlide, runIntegrityCheck, buildContext, createImageRequests, imagePromptFor } from "../generation/service";
import { relayoutSlide, remapFragments } from "../generation/engine";
import { applyOps, type AmendOp } from "./ops";
import { interpretAmend, describeOp } from "./interpret";
import { enqueue } from "../jobs/runner";
import type { SlideModel, TextProps } from "../types";

interface Snapshot { slides: SlideModel[]; blocks: { id: string; text: string }[]; createdSlideIds: string[] }

export async function listAmends(presentationId: string, slideId: string | null | undefined) {
  return prisma.amend.findMany({ where: { presentationId, ...(slideId === undefined ? {} : { slideId }) }, orderBy: { createdAt: "asc" } });
}

export async function submitAmend(presentationId: string, slideId: string | null, message: string, userId: string) {
  const p = await prisma.presentation.findUniqueOrThrow({ where: { id: presentationId } });
  const slides = await loadSlides(presentationId);
  const slide = slideId ? slides.find((s) => s.id === slideId) || null : null;
  if (slideId && !slide) throw new Error("Slide not found");
  const styles = await prisma.visualStyle.findMany({ where: { OR: [{ userId }, { isBuiltIn: true }] }, select: { id: true, name: true } });
  const history = await prisma.amend.findMany({ where: { presentationId, slideId }, orderBy: { createdAt: "desc" }, take: 8 });
  await prisma.amend.create({ data: { presentationId, slideId, role: "user", message } });
  const { result, interpreter } = await interpretAmend(message, { slide, slideIndex: slide?.index ?? null, slideCount: slides.length, styleNames: styles.map((s) => s.name), history: history.reverse().map((h) => ({ role: h.role, message: h.message })), language: p.language });

  if (!result.operations.length) {
    return prisma.amend.create({ data: { presentationId, slideId, role: "assistant", message: result.reply, status: "unclear", interpreter, operations: [] } });
  }
  const targets = slide ? [slide] : slides;
  const blocks = await loadBlocks(presentationId);
  const snapshot: Snapshot = { slides: JSON.parse(JSON.stringify(targets)), blocks: blocks.map((b) => ({ id: b.id, text: b.text })), createdSlideIds: [] };
  const applied: string[] = []; const skipped: string[] = []; let status: "applied" | "partial" | "failed" = "applied";
  try {
    const deferred: AmendOp[] = [];
    const changedSlides: SlideModel[] = [];
    const blockChanges = new Map<string, string>();
    for (const s of targets) {
      const r = applyOps(s, result.operations);
      changedSlides.push(r.slide); applied.push(...r.applied); skipped.push(...r.skipped);
      for (const c of r.blockTextChanges) blockChanges.set(c.blockId, c.text);
      if (!deferred.length) deferred.push(...r.deferred);
    }
    // persist immediate changes (ids stay stable)
    const all = slides.map((s) => changedSlides.find((c) => c.id === s.id) || s);
    await saveSlides(presentationId, all);
    for (const [blockId, text] of blockChanges) {
      const b = blocks.find((x) => x.id === blockId); if (!b) continue;
      await prisma.contentBlock.update({ where: { id: blockId }, data: { text } });
      await prisma.projectHistory.create({ data: { presentationId, action: "content.amended", details: { blockId, before: b.text.slice(0, 500), after: text.slice(0, 500), via: "amend" } as Prisma.InputJsonValue } });
      applied.push(`Source block ${b.index + 1} updated with the authorized wording (original kept in project history).`);
    }
    // deferred structural operations
    for (const op of deferred) {
      if (op.op === "regenerate") {
        const style = op.styleName ? styles.find((s) => s.name.toLowerCase() === op.styleName!.toLowerCase()) : null;
        if (op.styleName && !style) { skipped.push(`Style “${op.styleName}” not found`); continue; }
        const ids = slide ? [slide.id!] : slides.map((s) => s.id!);
        const { ctx } = await buildContext(presentationId, style?.id || null);
        for (const id of ids) {
          const cur = (await loadSlides(presentationId)).find((s) => s.id === id); if (!cur) continue;
          const { slides: made, fragMeta } = relayoutSlide(ctx, cur, Math.max(1, (cur.index || 0)));
          remapFragments(made, fragMeta);
          const newIds = await replaceOneSlide(presentationId, id, made);
          snapshot.createdSlideIds.push(...newIds);
          if (ctx.aiImages) { const imgs = await createImageRequests(presentationId, newIds); for (const i of imgs) await enqueue("image", i); }
        }
        if (!slide && style) await prisma.presentation.update({ where: { id: presentationId }, data: { styleId: style.id } });
        applied.push(style ? `Re-laid out ${ids.length} slide(s) in ${style.name}` : `Re-laid out ${ids.length} slide(s)`);
      } else if (op.op === "split_slide") {
        if (!slide) { skipped.push("Split needs a specific slide"); continue; }
        const cur = (await loadSlides(presentationId)).find((s) => s.id === slide.id)!;
        const content = cur.elements.filter((e) => e.type === "text" && e.blockId && (e.props as TextProps).role !== "h1" && (e.props as TextProps).role !== "h2").sort((a, b) => a.y - b.y || a.x - b.x);
        if (content.length < 2) { skipped.push("Not enough content on this slide to split"); continue; }
        const half = Math.ceil(content.length / 2);
        const second = new Set(content.slice(half));
        const A: SlideModel = { ...cur, elements: cur.elements.filter((e) => !second.has(e)) };
        const B: SlideModel = { ...cur, id: undefined, elements: cur.elements.filter((e) => second.has(e) || (e.type !== "text")) };
        const { ctx } = await buildContext(presentationId, cur.styleId || null);
        const ra = relayoutSlide(ctx, A, 1); const rb = relayoutSlide(ctx, B, 1);
        const meta = new Map([...ra.fragMeta, ...rb.fragMeta]);
        const made = [...ra.slides, ...rb.slides];
        remapFragments(made, meta);
        const newIds = await replaceOneSlide(presentationId, cur.id!, made);
        snapshot.createdSlideIds.push(...newIds);
        applied.push(`Split the slide into ${made.length} slides`);
      } else if (op.op === "image_concept") {
        const img = slide ? await prisma.generatedImage.findFirst({ where: { presentationId, slideId: slide.id }, orderBy: { createdAt: "desc" } }) : null;
        if (!img) { skipped.push("This slide has no AI image slot. Turn on AI images and regenerate the slide to add one."); continue; }
        const prompt = await imagePromptFor(presentationId, op.concept);
        await prisma.generatedImage.update({ where: { id: img.id }, data: { concept: op.concept, prompt, status: "pending", error: null } });
        await enqueue("image", img.id); applied.push("Queued a new AI image with the updated concept");
      }
    }
    await runIntegrityCheck(presentationId);
    if (!applied.length) status = "failed"; else if (skipped.length) status = "partial";
  } catch (e) {
    status = "failed"; skipped.push((e as Error).message);
  }
  const summary = [result.reply, applied.length ? `✓ ${applied.join(" · ")}` : "", skipped.length ? `⚠ ${skipped.join(" · ")}` : ""].filter(Boolean).join("\n");
  await prisma.projectHistory.create({ data: { presentationId, action: "amend.applied", details: { slideId, message, operations: result.operations.map(describeOp), status } as Prisma.InputJsonValue } });
  return prisma.amend.create({ data: { presentationId, slideId, role: "assistant", message: summary, status, interpreter, operations: result.operations as unknown as Prisma.InputJsonValue, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
}

export async function undoAmend(amendId: string) {
  const a = await prisma.amend.findUniqueOrThrow({ where: { id: amendId } });
  if (a.role !== "assistant" || !a.snapshot || a.status === "undone") throw new Error("Nothing to undo for this message");
  const snap = a.snapshot as unknown as Snapshot;
  const current = await loadSlides(a.presentationId);
  // remove slides created by structural ops, restore the snapshot slides at their original positions
  let rest = current.filter((s) => !snap.createdSlideIds.includes(s.id!));
  for (const s of snap.slides) { const idx = rest.findIndex((x) => x.id === s.id); if (idx >= 0) rest[idx] = s; else { rest.push(s); } }
  rest = rest.sort((x, y) => x.index - y.index).map((s, i) => ({ ...s, index: i }));
  // slides restored from snapshot may reference ids that were deleted; saveSlides recreates them
  await saveSlides(a.presentationId, rest);
  for (const b of snap.blocks) { const cur = await prisma.contentBlock.findUnique({ where: { id: b.id } }); if (cur && cur.text !== b.text) await prisma.contentBlock.update({ where: { id: b.id }, data: { text: b.text } }); }
  await runIntegrityCheck(a.presentationId);
  await prisma.projectHistory.create({ data: { presentationId: a.presentationId, action: "amend.undone", details: { amendId } } });
  return prisma.amend.update({ where: { id: amendId }, data: { status: "undone" } });
}
