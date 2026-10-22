import { z } from "zod";
import type { ElementModel, ImageProps, ShapeProps, SlideModel, TextProps } from "../types";
import { CANVAS_H, CANVAS_W } from "../types";

/** Target selector for elements on a slide. */
export const targetSchema = z.object({
  elementId: z.string().optional(),
  role: z.enum(["heading", "body", "list", "caption", "label", "number", "image", "logo", "shape", "all_text", "all"]).optional(),
  textMatch: z.string().optional(),   // substring of the element's text
  index: z.number().int().optional(), // nth matching (0-based)
}).default({});
export type Target = z.infer<typeof targetSchema>;

export const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("style_text"), target: targetSchema, fontSize: z.number().optional(), fontSizeDelta: z.number().optional(), fontSizeScale: z.number().optional(), color: z.string().optional(), align: z.enum(["left", "center", "right"]).optional(), fontWeight: z.number().optional(), fontFamily: z.string().optional(), lineHeight: z.number().optional(), textTransform: z.enum(["uppercase", "none"]).optional(), italic: z.boolean().optional(), letterSpacing: z.number().optional(), opacity: z.number().optional(), valign: z.enum(["top", "middle", "bottom"]).optional(), dir: z.enum(["ltr", "rtl"]).optional() }),
  z.object({ op: z.literal("move"), target: targetSchema, x: z.number().optional(), y: z.number().optional(), dx: z.number().optional(), dy: z.number().optional(), position: z.enum(["left", "right", "top", "bottom", "center", "top-left", "top-right", "bottom-left", "bottom-right"]).optional() }),
  z.object({ op: z.literal("resize"), target: targetSchema, w: z.number().optional(), h: z.number().optional(), scale: z.number().optional() }),
  z.object({ op: z.literal("set_text"), target: targetSchema, text: z.string() }),                          // authorized wording change
  z.object({ op: z.literal("replace_text"), target: targetSchema, find: z.string(), replace: z.string() }), // authorized wording change
  z.object({ op: z.literal("remove"), target: targetSchema }),
  z.object({ op: z.literal("add_text"), text: z.string(), x: z.number().optional(), y: z.number().optional(), w: z.number().optional(), h: z.number().optional(), fontSize: z.number().optional(), color: z.string().optional(), role: z.enum(["heading", "body", "caption"]).optional() }),
  z.object({ op: z.literal("add_shape"), shape: z.enum(["rect", "ellipse"]).default("rect"), x: z.number().optional(), y: z.number().optional(), w: z.number().optional(), h: z.number().optional(), fill: z.string().optional(), radius: z.number().optional() }),
  z.object({ op: z.literal("set_background"), color: z.string().optional(), gradient: z.string().nullable().optional(), removeImage: z.boolean().optional(), overlay: z.string().nullable().optional() }),
  z.object({ op: z.literal("image"), target: targetSchema.optional(), fit: z.enum(["cover", "contain"]).optional(), opacity: z.number().optional(), radius: z.number().optional(), remove: z.boolean().optional(), cssFilter: z.string().nullable().optional() }),
  z.object({ op: z.literal("layer"), target: targetSchema, direction: z.enum(["front", "back", "forward", "backward"]) }),
  z.object({ op: z.literal("regenerate"), styleName: z.string().optional() }),      // re-lay out this slide (optionally in another style)
  z.object({ op: z.literal("split_slide") }),                                       // move the second half of the content to a new slide
  z.object({ op: z.literal("image_concept"), concept: z.string() }),               // regenerate the AI image with a new concept
  z.object({ op: z.literal("note"), text: z.string() }),                            // slide notes
]);
export type AmendOp = z.infer<typeof opSchema>;

export const interpretationSchema = z.object({ reply: z.string(), operations: z.array(opSchema).default([]), needsClarification: z.boolean().optional() });
export type Interpretation = z.infer<typeof interpretationSchema>;

const roleOf = (e: ElementModel) => (e.props as TextProps).role;
const txt = (e: ElementModel) => ((e.props as TextProps).text || "").toLowerCase();

export function resolveTargets(slide: SlideModel, t: Target | undefined): ElementModel[] {
  const els = slide.elements;
  if (!t || (!t.elementId && !t.role && !t.textMatch)) return [];
  let list = els;
  if (t.elementId) list = list.filter((e) => e.id === t.elementId);
  if (t.role) {
    list = list.filter((e) => {
      if (t.role === "all") return true;
      if (t.role === "all_text") return e.type === "text";
      if (t.role === "image") return e.type === "image";
      if (t.role === "logo") return e.type === "logo";
      if (t.role === "shape") return e.type === "shape";
      if (e.type !== "text") return false;
      const r = roleOf(e);
      if (t.role === "heading") return r === "h1" || r === "h2" || r === "h3";
      if (t.role === "list") return !!(e.props as TextProps).bullet || (e.blockId != null && r === "body" && /^\s*(\d+|[٠-٩]+)[.)]/.test((e.props as TextProps).text));
      if (t.role === "body") return r === "body" || r === "quote";
      return r === t.role;
    });
  }
  if (t.textMatch) { const m = t.textMatch.toLowerCase(); list = list.filter((e) => e.type === "text" && txt(e).includes(m)); }
  if (t.index != null) return list[t.index] ? [list[t.index]] : [];
  return list;
}

export interface ApplyResult { slide: SlideModel; extraSlides: SlideModel[]; blockTextChanges: { blockId: string; text: string }[]; deferred: AmendOp[]; applied: string[]; skipped: string[] }

/** Applies operations to a slide model (pure). Regenerate/split/image_concept are returned as deferred for the service layer. */
export function applyOps(input: SlideModel, ops: AmendOp[]): ApplyResult {
  const slide: SlideModel = JSON.parse(JSON.stringify(input));
  const res: ApplyResult = { slide, extraSlides: [], blockTextChanges: [], deferred: [], applied: [], skipped: [] };
  const maxZ = () => Math.max(0, ...slide.elements.map((e) => e.z)) + 1;
  for (const op of ops) {
    const targets = "target" in op && op.target ? resolveTargets(slide, op.target) : [];
    const need = (label: string) => { if (!targets.length) { res.skipped.push(`${label}: no matching element`); return false; } return true; };
    switch (op.op) {
      case "style_text": {
        if (!need("style_text")) break;
        for (const e of targets) {
          if (e.type !== "text") continue;
          const p = e.props as TextProps;
          if (op.fontSize) p.fontSize = op.fontSize; if (op.fontSizeDelta) p.fontSize = Math.max(12, p.fontSize + op.fontSizeDelta); if (op.fontSizeScale) p.fontSize = Math.max(12, Math.round(p.fontSize * op.fontSizeScale));
          if (op.color) p.color = op.color; if (op.align) p.align = op.align; if (op.fontWeight) p.fontWeight = op.fontWeight; if (op.fontFamily) p.fontFamily = op.fontFamily; if (op.lineHeight) p.lineHeight = op.lineHeight;
          if (op.textTransform) p.textTransform = op.textTransform; if (op.italic != null) p.italic = op.italic; if (op.letterSpacing != null) p.letterSpacing = op.letterSpacing; if (op.opacity != null) p.opacity = op.opacity; if (op.valign) p.valign = op.valign; if (op.dir) p.dir = op.dir;
          if (op.fontSize || op.fontSizeDelta || op.fontSizeScale) e.h = Math.max(e.h, p.fontSize * p.lineHeight * 1.2);
        }
        res.applied.push(`Styled ${targets.length} text element(s)`); break;
      }
      case "move": {
        if (!need("move")) break;
        for (const e of targets) {
          if (op.x != null) e.x = op.x; if (op.y != null) e.y = op.y; if (op.dx) e.x += op.dx; if (op.dy) e.y += op.dy;
          const M = 100;
          if (op.position) {
            if (op.position.includes("left")) e.x = M; if (op.position.includes("right")) e.x = CANVAS_W - M - e.w;
            if (op.position.includes("top")) e.y = M; if (op.position.includes("bottom")) e.y = CANVAS_H - M - e.h;
            if (op.position === "center") { e.x = (CANVAS_W - e.w) / 2; e.y = (CANVAS_H - e.h) / 2; }
          }
          e.x = Math.max(-e.w / 2, Math.min(CANVAS_W - e.w / 2, e.x)); e.y = Math.max(-e.h / 2, Math.min(CANVAS_H - e.h / 2, e.y));
        }
        res.applied.push(`Moved ${targets.length} element(s)`); break;
      }
      case "resize": {
        if (!need("resize")) break;
        for (const e of targets) { if (op.w) e.w = op.w; if (op.h) e.h = op.h; if (op.scale) { e.w = Math.round(e.w * op.scale); e.h = Math.round(e.h * op.scale); } }
        res.applied.push(`Resized ${targets.length} element(s)`); break;
      }
      case "set_text": {
        if (!need("set_text")) break;
        const e = targets[0]; if (e.type !== "text") { res.skipped.push("set_text: target is not text"); break; }
        (e.props as TextProps).text = op.text;
        if (e.blockId && (e.fragmentCount || 1) === 1) res.blockTextChanges.push({ blockId: e.blockId, text: op.text });
        else if (e.blockId) res.skipped.push("set_text: this text is a fragment of a longer block; the source block was not updated (integrity will report the difference)");
        res.applied.push(`Replaced text of 1 element (authorized wording change)`); break;
      }
      case "replace_text": {
        const list = targets.length ? targets : slide.elements.filter((e) => e.type === "text");
        let n = 0;
        for (const e of list) { if (e.type !== "text") continue; const p = e.props as TextProps; if (p.text.includes(op.find)) { p.text = p.text.split(op.find).join(op.replace); n++; if (e.blockId && (e.fragmentCount || 1) === 1) res.blockTextChanges.push({ blockId: e.blockId, text: p.text }); } }
        if (n) res.applied.push(`Replaced “${op.find}” with “${op.replace}” in ${n} element(s) (authorized wording change)`); else res.skipped.push(`replace_text: “${op.find}” not found on this slide`);
        break;
      }
      case "remove": {
        if (!need("remove")) break;
        slide.elements = slide.elements.filter((e) => !targets.includes(e));
        res.applied.push(`Removed ${targets.length} element(s)`); break;
      }
      case "add_text": {
        const body = slide.elements.find((e) => e.type === "text" && roleOf(e) === "body") || slide.elements.find((e) => e.type === "text");
        const base = body ? (body.props as TextProps) : null;
        const size = op.fontSize || (op.role === "heading" ? 56 : op.role === "caption" ? 20 : base?.fontSize || 28);
        const dir: "rtl" | "ltr" = /[؀-ۿ]/.test(op.text) ? "rtl" : "ltr";
        slide.elements.push({ type: "text", origin: "user", x: op.x ?? 120, y: op.y ?? CANVAS_H - 260, w: op.w ?? 1200, h: op.h ?? size * 1.5 * 2, z: maxZ(), props: { text: op.text, fontFamily: dir === "rtl" ? "Cairo" : base?.fontFamily || "Inter", fontSize: size, fontWeight: op.role === "heading" ? 700 : 400, color: op.color || base?.color || "#ffffff", align: dir === "rtl" ? "right" : "left", dir, lang: dir === "rtl" ? "ar" : "en", lineHeight: 1.4, role: op.role === "heading" ? "h2" : op.role === "caption" ? "caption" : "body" } as TextProps });
        res.applied.push("Added a text element (user text, not part of the source content)"); break;
      }
      case "add_shape": {
        slide.elements.unshift({ type: "shape", origin: "user", x: op.x ?? 120, y: op.y ?? 120, w: op.w ?? 400, h: op.h ?? 200, z: 0, props: { shape: op.shape, fill: op.fill || "#888888", radius: op.radius || 0 } as ShapeProps });
        res.applied.push("Added a shape"); break;
      }
      case "set_background": {
        if (op.color) slide.background.color = op.color;
        if (op.gradient !== undefined) slide.background.gradient = op.gradient || undefined;
        if (op.overlay !== undefined) slide.background.overlay = op.overlay || undefined;
        if (op.removeImage) { slide.background.imageSrc = undefined; slide.background.imageAssetId = undefined; slide.background.generatedImageId = undefined; }
        res.applied.push("Updated the background"); break;
      }
      case "image": {
        const imgs = op.target && (op.target.elementId || op.target.role || op.target.textMatch) ? resolveTargets(slide, op.target) : slide.elements.filter((e) => e.type === "image");
        if (!imgs.length) { res.skipped.push("image: no image on this slide"); break; }
        if (op.remove) slide.elements = slide.elements.filter((e) => !imgs.includes(e));
        else for (const e of imgs) { const p = e.props as ImageProps; if (op.fit) p.fit = op.fit; if (op.opacity != null) p.opacity = op.opacity; if (op.radius != null) p.radius = op.radius; if (op.cssFilter !== undefined) p.cssFilter = op.cssFilter || undefined; }
        res.applied.push(op.remove ? `Removed ${imgs.length} image(s)` : `Adjusted ${imgs.length} image(s)`); break;
      }
      case "layer": {
        if (!need("layer")) break;
        for (const e of targets) e.z = op.direction === "front" ? maxZ() : op.direction === "back" ? 0 : op.direction === "forward" ? e.z + 1 : Math.max(0, e.z - 1);
        res.applied.push("Changed layer order"); break;
      }
      case "note": slide.notes = op.text; res.applied.push("Updated slide notes"); break;
      case "regenerate": case "split_slide": case "image_concept": res.deferred.push(op); break;
    }
  }
  return res;
}

/** Compact description of a slide for the interpreter prompt and for the UI. */
export function describeSlide(slide: SlideModel) {
  return slide.elements.filter((e) => e.origin !== "decoration" || e.type === "text").map((e) => ({ id: e.id, type: e.type, role: e.type === "text" ? roleOf(e) : undefined, origin: e.origin, text: e.type === "text" ? (e.props as TextProps).text.slice(0, 90) : undefined, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w), h: Math.round(e.h), fontSize: e.type === "text" ? (e.props as TextProps).fontSize : undefined, color: e.type === "text" ? (e.props as TextProps).color : (e.props as ShapeProps).fill, isSourceContent: !!e.blockId }));
}
