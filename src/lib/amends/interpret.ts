import { generateJson } from "../images/nanobanana";
import { interpretationSchema, opSchema, type AmendOp, type Interpretation, type Target, describeSlide } from "./ops";
import type { SlideModel } from "../types";

export interface InterpretContext { slide: SlideModel | null; slideIndex: number | null; slideCount: number; styleNames: string[]; history: { role: string; message: string }[]; language: string }

/** Interprets a free-text amend into validated operations. Uses the Gemini text model when configured, else rules. */
export async function interpretAmend(message: string, ctx: InterpretContext): Promise<{ result: Interpretation; interpreter: "ai" | "rules" }> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = await aiInterpret(message, ctx);
      if (ai) return { result: ai, interpreter: "ai" };
    } catch (e) { console.warn("[amends] AI interpreter failed, falling back to rules:", (e as Error).message); }
  }
  return { result: rulesInterpret(message, ctx), interpreter: "rules" };
}

const OPS_DOC = `Operations (JSON objects). "target" selects elements: {"elementId"} or {"role": "heading"|"body"|"list"|"caption"|"label"|"number"|"image"|"logo"|"shape"|"all_text"|"all", "textMatch"?: substring, "index"?: n}.
- {"op":"style_text","target":T,"fontSize"?,"fontSizeDelta"?,"fontSizeScale"?,"color"?:"#hex","align"?:"left|center|right","fontWeight"?:100-900,"fontFamily"?,"lineHeight"?,"textTransform"?:"uppercase|none","italic"?,"letterSpacing"?,"opacity"?,"valign"?,"dir"?}
- {"op":"move","target":T,"x"?,"y"?,"dx"?,"dy"?,"position"?:"left|right|top|bottom|center|top-left|top-right|bottom-left|bottom-right"}  (canvas is 1920x1080)
- {"op":"resize","target":T,"w"?,"h"?,"scale"?}
- {"op":"set_text","target":T,"text":"..."}  ONLY when the user explicitly dictates new wording.
- {"op":"replace_text","target":T,"find":"...","replace":"..."}  ONLY when the user explicitly asks to replace specific words.
- {"op":"remove","target":T}
- {"op":"add_text","text":"...","x"?,"y"?,"w"?,"h"?,"fontSize"?,"color"?,"role"?:"heading|body|caption"}
- {"op":"add_shape","shape":"rect|ellipse","x"?,"y"?,"w"?,"h"?,"fill"?,"radius"?}
- {"op":"set_background","color"?:"#hex","gradient"?:"css gradient or null","removeImage"?:true,"overlay"?}
- {"op":"image","target"?:T,"fit"?:"cover|contain","opacity"?,"radius"?,"remove"?:true,"cssFilter"?}
- {"op":"layer","target":T,"direction":"front|back|forward|backward"}
- {"op":"regenerate","styleName"?:"<one of the style names>"}  re-lay out the slide (optionally in another style)
- {"op":"split_slide"}  move the second half of the content to a new slide
- {"op":"image_concept","concept":"..."}  regenerate the AI image with a new concept
- {"op":"note","text":"..."}`;

async function aiInterpret(message: string, ctx: InterpretContext): Promise<Interpretation | null> {
  const desc = ctx.slide ? JSON.stringify(describeSlide(ctx.slide)) : "(whole presentation; no single slide selected)";
  const prompt = `You are the revision assistant of a presentation design studio. Translate the designer's amend into operations for the current slide.
Rules: never invent, rewrite, translate or "improve" presentation wording on your own — only use set_text/replace_text when the designer explicitly supplies the new words. Prefer visual operations. If the request is ambiguous, set needsClarification=true and ask one short question in "reply". Reply in the designer's language (${ctx.language}).
Slide ${ctx.slideIndex != null ? ctx.slideIndex + 1 : "-"} of ${ctx.slideCount}. Elements: ${desc}
Available style names: ${ctx.styleNames.join(", ")}
Recent conversation: ${ctx.history.slice(-6).map((h) => `${h.role}: ${h.message}`).join(" | ") || "(none)"}
${OPS_DOC}
Designer's amend: """${message}"""`;
  const out = await generateJson<unknown>(prompt, `{"reply":"string","operations":[...],"needsClarification":false}`);
  if (!out) return null;
  const parsed = interpretationSchema.safeParse(out);
  if (!parsed.success) {
    // salvage valid operations individually
    const raw = (out as { reply?: string; operations?: unknown[] }) || {};
    const ops = (Array.isArray(raw.operations) ? raw.operations : []).map((o) => opSchema.safeParse(o)).filter((r) => r.success).map((r) => (r as { data: AmendOp }).data);
    return { reply: typeof raw.reply === "string" ? raw.reply : "Applied what I could interpret.", operations: ops, needsClarification: ops.length === 0 };
  }
  return parsed.data;
}

/* ------------------------------ rule-based interpreter ------------------------------ */
const COLORS: Record<string, string> = { black: "#111111", white: "#ffffff", red: "#d6301d", blue: "#2563eb", navy: "#0e1b2e", green: "#16a34a", gold: "#c9a85c", yellow: "#facc15", orange: "#f97316", purple: "#7c3aed", grey: "#6b7280", gray: "#6b7280", dark: "#111111", light: "#f5f5f5", beige: "#f3efe6", cream: "#f3efe6", teal: "#0d9488", pink: "#ec4899",
  "أسود": "#111111", "اسود": "#111111", "أبيض": "#ffffff", "ابيض": "#ffffff", "أحمر": "#d6301d", "احمر": "#d6301d", "أزرق": "#2563eb", "ازرق": "#2563eb", "أخضر": "#16a34a", "اخضر": "#16a34a", "ذهبي": "#c9a85c", "أصفر": "#facc15", "اصفر": "#facc15", "رمادي": "#6b7280", "داكن": "#111111", "فاتح": "#f5f5f5", "بيج": "#f3efe6", "كحلي": "#0e1b2e" };

function colorIn(s: string): string | undefined {
  const hex = s.match(/#[0-9a-f]{3,6}\b/i); if (hex) return hex[0];
  for (const [name, hexv] of Object.entries(COLORS)) if (new RegExp(`(^|[^\\p{L}])${name}([^\\p{L}]|$)`, "iu").test(s)) return hexv;
  return undefined;
}
function targetIn(s: string): Target {
  if (/\b(title|heading|headline|header)\b|العنوان|عنوان/i.test(s)) return { role: "heading" };
  if (/\b(bullets?|list|items?|points?)\b|النقاط|القائمة|البنود/i.test(s)) return { role: "list" };
  if (/\b(body|paragraph|text|copy|description)\b|النص|الفقرة|الكلام/i.test(s)) return { role: "body" };
  if (/\b(caption|label|date|footer)\b|التسمية|التاريخ/i.test(s)) return { role: "caption" };
  if (/\b(logo)\b|الشعار|اللوجو/i.test(s)) return { role: "logo" };
  if (/\b(image|picture|photo|visual|illustration)\b|الصورة|صورة/i.test(s)) return { role: "image" };
  if (/\b(number|numeral)\b|الرقم/i.test(s)) return { role: "number" };
  if (/\b(everything|all text|all the text|whole slide|entire slide)\b|كل النصوص|كل شيء/i.test(s)) return { role: "all_text" };
  return { role: "all_text" };
}
const num = (s: string, re: RegExp) => { const m = s.match(re); return m ? Number(m[1]) : undefined; };

const mvWord = (l: string) => /\b(move|shift|push|put|place|nudge)\b|انقل|حرّك|حرك|ضع/i.test(l);

export function rulesInterpret(raw: string, ctx: InterpretContext): Interpretation {
  const s = raw.trim(); const l = s.toLowerCase(); const ops: AmendOp[] = []; const notes: string[] = [];
  const ar = /[؀-ۿ]/.test(s);
  const t = targetIn(l);
  const quoted = [...s.matchAll(/["“«']([^"”»']{1,400})["”»']/g)].map((m) => m[1]);

  // wording changes — only with explicit quoted text
  const repl = s.match(/replace\s+["“«']([^"”»']+)["”»']\s+(?:with|by)\s+["“«']([^"”»']*)["”»']/i) || s.match(/استبدل\s+["“«']([^"”»']+)["”»']\s+(?:بـ|ب)\s*["“«']([^"”»']*)["”»']/);
  if (repl) ops.push({ op: "replace_text", target: {}, find: repl[1], replace: repl[2] });
  else if (/\b(change|set|make|rewrite|update)\b.*\b(title|heading|headline|text|body|paragraph|caption)\b.*\bto\b/i.test(s) && quoted.length) ops.push({ op: "set_text", target: t.role === "all_text" ? { role: "body" } : t, text: quoted[quoted.length - 1] });
  else if (/غيّر|غير|اجعل|عدّل|عدل/.test(s) && /(العنوان|النص|الفقرة)/.test(s) && /إلى|الى/.test(s) && quoted.length) ops.push({ op: "set_text", target: t.role === "all_text" ? { role: "body" } : t, text: quoted[quoted.length - 1] });
  else if (/^(add|insert|write)\b.*\b(text|line|note|caption|sentence)\b/i.test(s) && quoted.length) ops.push({ op: "add_text", text: quoted[quoted.length - 1], role: /caption|small/i.test(s) ? "caption" : "body" });
  else if (/^(أضف|اضف|أضيفي|اكتب)\b/.test(s) && quoted.length) ops.push({ op: "add_text", text: quoted[quoted.length - 1] });

  // deferred structural ops
  if (/\b(split|break)\b.*\b(slide|two|2)\b|\btoo (much|crowded|dense)\b|قسّم|قسم|انقل .*شريحة جديدة|مزدحم/i.test(l)) ops.push({ op: "split_slide" });
  if (/\b(regenerate|re-?lay ?out|redo|redesign|new layout|different layout|another layout|try again)\b|أعد|اعد التصميم|تصميم آخر|تخطيط آخر/i.test(l)) {
    const style = ctx.styleNames.find((n) => l.includes(n.toLowerCase()));
    ops.push({ op: "regenerate", styleName: style });
  } else { const style = ctx.styleNames.find((n) => l.includes(n.toLowerCase())); if (style && /\b(style|direction|look)\b|ستايل|أسلوب|اسلوب/i.test(l)) ops.push({ op: "regenerate", styleName: style }); }
  if (/\b(image|picture|visual|photo)\b.*\b(concept|showing|of|depict|instead)\b|صورة .*(تظهر|عن|بدل)/i.test(l) && /\b(generate|regenerate|new|different|another|change)\b|ولّد|جديدة|مختلفة|غيّر/i.test(l)) { const concept = quoted[0] || s.replace(/.*\b(of|showing|depicting|with)\b/i, "").trim(); if (concept.length > 3) ops.push({ op: "image_concept", concept }); }

  // sizes
  const pct = num(l, /(\d+)\s*%/); const px = num(l, /(\d+)\s*(px|pt|points?)/); const toSize = num(l, /\b(?:size|to)\s+(\d{2,3})\b/);
  if (/\b(bigger|larger|increase|enlarge|grow|more prominent|bolder size)\b|أكبر|اكبر|كبّر|كبر|زود حجم/i.test(l)) ops.push({ op: "style_text", target: t.role === "image" || t.role === "logo" ? t : t, ...(pct ? { fontSizeScale: 1 + pct / 100 } : px ? { fontSizeDelta: px } : toSize ? { fontSize: toSize } : { fontSizeScale: 1.2 }) });
  else if (/\b(smaller|reduce|decrease|shrink|less prominent)\b|أصغر|اصغر|صغّر|صغر|قلل حجم/i.test(l)) ops.push({ op: "style_text", target: t, ...(pct ? { fontSizeScale: 1 - pct / 100 } : px ? { fontSizeDelta: -px } : toSize ? { fontSize: toSize } : { fontSizeScale: 0.85 }) });
  else if (toSize && /\b(size|font)\b|حجم/i.test(l)) ops.push({ op: "style_text", target: t, fontSize: toSize });
  if ((t.role === "image" || t.role === "logo") && ops.length && ops[ops.length - 1].op === "style_text") { const o = ops.pop() as Extract<AmendOp, { op: "style_text" }>; ops.push({ op: "resize", target: t, scale: o.fontSizeScale || (o.fontSizeDelta ? (o.fontSizeDelta > 0 ? 1.2 : 0.85) : 1.2) }); }

  // weight / case / alignment / spacing
  if (/\b(bold|heavier|bolder)\b|عريض|أثقل|غامق/i.test(l) && !/\bless bold\b/.test(l)) ops.push({ op: "style_text", target: t, fontWeight: 700 });
  if (/\b(lighter weight|thinner|light weight|less bold|regular weight)\b|أخف|رفيع/i.test(l)) ops.push({ op: "style_text", target: t, fontWeight: 300 });
  if (/\b(uppercase|all caps|capitals)\b|أحرف كبيرة/i.test(l)) ops.push({ op: "style_text", target: t.role === "all_text" ? { role: "heading" } : t, textTransform: "uppercase" });
  if (/\b(lowercase|no caps|sentence case|not uppercase)\b/i.test(l)) ops.push({ op: "style_text", target: t, textTransform: "none" });
  if (/\b(italic)\b|مائل/i.test(l)) ops.push({ op: "style_text", target: t, italic: !/\bnot italic|remove italic\b/.test(l) });
  if (/\b(align|aligned|justify)\b.*\b(left)\b|\bleft[- ]align|محاذاة .*يسار|لليسار/i.test(l)) ops.push({ op: "style_text", target: t, align: "left" });
  if (/\b(align|aligned)\b.*\b(right)\b|\bright[- ]align|محاذاة .*يمين|لليمين/i.test(l)) ops.push({ op: "style_text", target: t, align: "right" });
  if (/\b(center|centre|centered|centred)\b(?! of)|توسيط|في الوسط|بالمنتصف/i.test(l) && !/\bmove\b|انقل|حرّك/i.test(l)) ops.push({ op: "style_text", target: t, align: "center" });
  if (/\b(line spacing|line height|leading)\b|تباعد الأسطر/i.test(l)) ops.push({ op: "style_text", target: t, lineHeight: /\b(more|increase|bigger|looser)\b|أكثر|زد/i.test(l) ? 1.7 : /\b(less|tighter|reduce|smaller)\b|أقل|قلل/i.test(l) ? 1.2 : 1.45 });
  if (/\b(letter spacing|tracking)\b|تباعد الأحرف/i.test(l)) ops.push({ op: "style_text", target: t, letterSpacing: /\b(more|wider|increase)\b|أكثر/i.test(l) ? 3 : 0 });

  // colors
  const color = colorIn(l);
  if (color) {
    if (/\b(background|bg|backdrop)\b|الخلفية|خلفية/i.test(l)) ops.push({ op: "set_background", color, gradient: null });
    else if (!mvWord(l)) ops.push({ op: "style_text", target: t, color });
  } else if (/\b(darker|dark background|dark theme)\b|خلفية داكنة|أغمق/i.test(l) && /background|خلفية|slide|الشريحة/i.test(l)) ops.push({ op: "set_background", color: "#0b0b0e", gradient: null });
  else if (/\b(lighter|light background|white background)\b|خلفية فاتحة|خلفية بيضاء|أفتح/i.test(l) && /background|خلفية|slide|الشريحة/i.test(l)) ops.push({ op: "set_background", color: "#f5f5f2", gradient: null });
  if (/\b(remove|delete|drop|hide)\b.*\b(background image|background picture|bg image)\b|احذف صورة الخلفية/i.test(l)) ops.push({ op: "set_background", removeImage: true });

  // moves
  const mv = /\b(move|shift|push|put|place|nudge)\b|انقل|حرّك|حرك|ضع/i.test(l);
  if (mv) {
    const absolute = /\b(to|at|on|into) the\b|إلى|الى|في/i.test(l) && !/\b(a bit|slightly|little)\b|قليلاً|قليلا|شوية/i.test(l);
    const position = /top[- ]left|أعلى اليسار/i.test(l) ? "top-left" : /top[- ]right|أعلى اليمين/i.test(l) ? "top-right" : /bottom[- ]left|أسفل اليسار/i.test(l) ? "bottom-left" : /bottom[- ]right|أسفل اليمين/i.test(l) ? "bottom-right" : /\b(center|centre|middle)\b|الوسط|المنتصف/i.test(l) ? "center" : absolute && /\b(top)\b|أعلى/i.test(l) ? "top" : absolute && /\b(bottom)\b|أسفل/i.test(l) ? "bottom" : absolute && /\b(left)\b|يسار/i.test(l) ? "left" : absolute && /\b(right)\b|يمين/i.test(l) ? "right" : undefined;
    const amount = px || (/\b(a bit|slightly|little)\b|قليلاً|قليلا|شوية/i.test(l) ? 40 : 120);
    if (/\b(up|higher|top)\b|فوق|لأعلى|أعلى/i.test(l) && !position) ops.push({ op: "move", target: t, dy: -amount });
    else if (/\b(down|lower|bottom)\b|تحت|لأسفل|أسفل/i.test(l) && !position) ops.push({ op: "move", target: t, dy: amount });
    else if (position) ops.push({ op: "move", target: t, position });
    else if (/\bleft\b|يسار/i.test(l)) ops.push({ op: "move", target: t, dx: -amount });
    else if (/\bright\b|يمين/i.test(l)) ops.push({ op: "move", target: t, dx: amount });
  }
  // remove / layer / image ops
  if (/^(remove|delete|hide|drop|get rid of)\b|^(احذف|ازل|أزل|اخفِ|أخف)/i.test(l) && !ops.some((o) => o.op === "set_background" && (o as { removeImage?: boolean }).removeImage) && !/background image|صورة الخلفية/i.test(l)) {
    if (t.role === "image" || t.role === "logo") ops.push({ op: "image", target: t, remove: true }); else if (t.role !== "all_text") ops.push({ op: "remove", target: t }); else notes.push("Tell me which element to remove (heading, body, image, logo, number…).");
  }
  if (/\b(bring|send)\b.*\b(front|forward|back|backward|behind)\b/i.test(l)) ops.push({ op: "layer", target: t, direction: /front/i.test(l) ? "front" : /forward/i.test(l) ? "forward" : /backward/i.test(l) ? "backward" : "back" });
  if ((t.role === "image" || t.role === "logo") && /\b(contain|fit inside|no crop|don'?t crop)\b/i.test(l)) ops.push({ op: "image", target: t, fit: "contain" });
  if ((t.role === "image" || t.role === "logo") && /\b(cover|fill|crop)\b/i.test(l)) ops.push({ op: "image", target: t, fit: "cover" });
  if ((t.role === "image") && /\b(rounded|round corners)\b|زوايا دائرية/i.test(l)) ops.push({ op: "image", target: t, radius: 24 });
  if ((t.role === "image") && /\b(fade|transparent|opacity|dim)\b|شفافية/i.test(l)) ops.push({ op: "image", target: t, opacity: pct ? pct / 100 : 0.6 });
  if (/\b(note|notes)\b:?\s*(.+)/i.test(s) && !/\bnote (the|that)\b/i.test(l)) { const m = s.match(/\bnotes?\b:?\s*(.+)/i); if (m && !quoted.length) ops.push({ op: "note", text: m[1] }); }

  // whole-presentation requests without a slide
  if (!ctx.slide && ops.length) notes.push("No slide is selected: these operations will be applied to every slide.");

  const dedup: AmendOp[] = []; for (const o of ops) if (!dedup.some((d) => JSON.stringify(d) === JSON.stringify(o))) dedup.push(o);
  if (!dedup.length) {
    const hint = ar ? "لم أفهم التعديل المطلوب. جرّب مثلاً: «كبّر العنوان»، «لون النص ذهبي»، «انقل الصورة لليمين»، «خلفية داكنة»، «قسّم الشريحة»، «أعد التصميم بأسلوب Cinematic»، أو «غيّر العنوان إلى \"...\"»." : "I couldn't map that to a slide change. Try e.g. “make the heading bigger”, “body text gold”, “move the image to the left”, “dark background”, “split this slide”, “regenerate in Cinematic”, or “change the heading to \"…\"” (quoted wording is applied exactly).";
    return { reply: hint, operations: [], needsClarification: true };
  }
  const reply = (ar ? "تم تطبيق: " : "Applying: ") + dedup.map(describeOp).join("; ") + (notes.length ? ` — ${notes.join(" ")}` : "");
  return { reply, operations: dedup };
}

export function describeOp(o: AmendOp): string {
  const tg = (t?: Target) => (t?.role ? t.role.replace("_", " ") : t?.textMatch ? `text “${t.textMatch}”` : t?.elementId ? "element" : "elements");
  switch (o.op) {
    case "style_text": { const parts: string[] = []; if (o.fontSizeScale) parts.push(`size ×${o.fontSizeScale}`); if (o.fontSizeDelta) parts.push(`size ${o.fontSizeDelta > 0 ? "+" : ""}${o.fontSizeDelta}px`); if (o.fontSize) parts.push(`size ${o.fontSize}px`); if (o.color) parts.push(`color ${o.color}`); if (o.align) parts.push(`align ${o.align}`); if (o.fontWeight) parts.push(`weight ${o.fontWeight}`); if (o.textTransform) parts.push(o.textTransform); if (o.lineHeight) parts.push(`line height ${o.lineHeight}`); if (o.italic != null) parts.push(o.italic ? "italic" : "not italic"); if (o.letterSpacing != null) parts.push(`tracking ${o.letterSpacing}`); if (o.fontFamily) parts.push(`font ${o.fontFamily}`); return `${tg(o.target)} → ${parts.join(", ") || "style"}`; }
    case "move": return `move ${tg(o.target)} ${o.position || [o.dx ? `${o.dx > 0 ? "right" : "left"} ${Math.abs(o.dx)}px` : "", o.dy ? `${o.dy > 0 ? "down" : "up"} ${Math.abs(o.dy)}px` : ""].filter(Boolean).join(", ") || `to ${o.x ?? "·"},${o.y ?? "·"}`}`;
    case "resize": return `resize ${tg(o.target)}${o.scale ? ` ×${o.scale}` : ""}`;
    case "set_text": return `set ${tg(o.target)} wording to “${o.text.slice(0, 60)}”`;
    case "replace_text": return `replace “${o.find}” with “${o.replace}”`;
    case "remove": return `remove ${tg(o.target)}`;
    case "add_text": return `add text “${o.text.slice(0, 50)}”`;
    case "add_shape": return `add ${o.shape}`;
    case "set_background": return o.removeImage ? "remove background image" : `background ${o.color || ""}${o.gradient === null ? " (solid)" : ""}`;
    case "image": return o.remove ? "remove image" : "adjust image";
    case "layer": return `send ${tg(o.target)} ${o.direction}`;
    case "regenerate": return o.styleName ? `re-lay out in ${o.styleName}` : "re-lay out the slide";
    case "split_slide": return "split the slide in two";
    case "image_concept": return `new image concept “${o.concept.slice(0, 50)}”`;
    case "note": return "update notes";
  }
}
