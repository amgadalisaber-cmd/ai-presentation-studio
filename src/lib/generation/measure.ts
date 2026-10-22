/** Approximate text measurement for layout planning (final overflow is validated at render time). */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function charWidthFactor(ch: string, uppercase = false, weight = 400) {
  if (ARABIC.test(ch)) return 0.5;
  if (ch === " ") return 0.28;
  if (/[iljtfI.,;:'|!]/.test(ch)) return 0.3;
  if (/[mwMW@]/.test(ch)) return 0.85;
  if (/[A-Z]/.test(ch) || uppercase) return 0.68 + (weight >= 700 ? 0.05 : 0);
  if (/[0-9]/.test(ch)) return 0.58;
  return 0.54 + (weight >= 700 ? 0.04 : 0);
}

export function textWidth(text: string, fontSize: number, opts: { uppercase?: boolean; weight?: number; letterSpacing?: number } = {}) {
  let w = 0;
  for (const ch of text) w += charWidthFactor(ch, opts.uppercase, opts.weight) * fontSize + (opts.letterSpacing || 0);
  return w;
}

export function countLines(text: string, fontSize: number, width: number, opts: { uppercase?: boolean; weight?: number; letterSpacing?: number } = {}) {
  let lines = 0;
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let cur = 0; let l = 1;
    const space = charWidthFactor(" ") * fontSize;
    for (const word of words) {
      const ww = textWidth(word, fontSize, opts);
      if (cur === 0) cur = ww;
      else if (cur + space + ww <= width) cur += space + ww;
      else { l++; cur = ww; }
      if (ww > width) { l += Math.floor(ww / width); cur = ww % width; }
    }
    lines += l;
  }
  return Math.max(1, lines);
}

export function textHeight(text: string, fontSize: number, width: number, lineHeight: number, opts: { uppercase?: boolean; weight?: number; letterSpacing?: number } = {}) {
  return countLines(text, fontSize, width, opts) * fontSize * lineHeight;
}
