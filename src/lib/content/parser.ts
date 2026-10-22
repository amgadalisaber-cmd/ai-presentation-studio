import type { BlockModel, Dir, Lang } from "../types";

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN_RE = /[A-Za-zÀ-ɏ]/g;

export function detectLang(text: string): { lang: Lang; dir: Dir } {
  const ar = (text.match(ARABIC_RE) || []).length;
  const la = (text.match(LATIN_RE) || []).length;
  if (ar === 0 && la === 0) return { lang: "neutral", dir: "ltr" };
  const total = ar + la;
  if (ar / total >= 0.2 && la / total >= 0.2) return { lang: "mixed", dir: ar >= la ? "rtl" : "ltr" };
  return ar > la ? { lang: "ar", dir: "rtl" } : { lang: "en", dir: "ltr" };
}

export function detectPresentationLanguage(text: string): "ar" | "en" | "ar-en" | "other" {
  const ar = (text.match(ARABIC_RE) || []).length;
  const la = (text.match(LATIN_RE) || []).length;
  if (ar === 0 && la === 0) return "other";
  const total = ar + la;
  if (ar / total >= 0.15 && la / total >= 0.15) return "ar-en";
  return ar > la ? "ar" : "en";
}

const BULLET_RE = /^([-*•◦▪‣–—]|[•●■])\s+/;
const NUMBERED_RE = /^((\d+|[٠-٩]+|[a-zA-Z]|[ivxIVX]+)[.)\-:]\s+|[\(（]\d+[\)）]\s+)/;
const HEADING_MD_RE = /^(#{1,3})\s+(.+)$/;

/**
 * Parses the user-supplied content into ordered blocks WITHOUT altering wording.
 * Only line-level whitespace (trailing spaces, CRLF) and list markers are interpreted.
 * The rawText of each block is kept verbatim.
 */
export function parseContent(source: string): Omit<BlockModel, "id">[] {
  const text = source.replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const blocks: Omit<BlockModel, "id">[] = [];
  let sectionIndex = -1;
  let paraBuffer: string[] = [];
  let index = 0;

  const flushPara = () => {
    if (!paraBuffer.length) return;
    const raw = paraBuffer.join("\n");
    const t = raw.trim();
    const { lang, dir } = detectLang(t);
    blocks.push({ index: index++, kind: "paragraph", level: 0, text: t, rawText: raw, marker: null, lang, dir, sectionIndex: Math.max(sectionIndex, 0) });
    paraBuffer = [];
  };

  const isHeadingCandidate = (line: string, next: string | undefined, prev: string | undefined) => {
    const t = line.trim();
    if (!t) return false;
    if (HEADING_MD_RE.test(t)) return true;
    if (BULLET_RE.test(t) || NUMBERED_RE.test(t)) return false;
    const words = t.split(/\s+/).length;
    const endsSentence = /[.!?؟،,;:]$/.test(t) && !/:$/.test(t);
    const prevBlank = prev === undefined || prev.trim() === "";
    const nextBlank = next === undefined || next.trim() === "";
    // Short, isolated line (blank before & after) without sentence punctuation => heading.
    if (prevBlank && nextBlank && words <= 12 && !endsSentence) return true;
    // Short line directly followed by body text, ending with ":" or no punctuation, and preceded by blank.
    if (prevBlank && !nextBlank && words <= 8 && !endsSentence && t.length <= 70) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flushPara(); continue; }
    const md = t.match(HEADING_MD_RE);
    const bullet = t.match(BULLET_RE);
    const numbered = t.match(NUMBERED_RE);
    if (md) {
      flushPara();
      const level = md[1].length;
      if (level === 1 || sectionIndex < 0) sectionIndex++;
      const content = md[2].trim();
      const { lang, dir } = detectLang(content);
      blocks.push({ index: index++, kind: level === 1 ? "heading" : "subheading", level, text: content, rawText: line, marker: md[1], lang, dir, sectionIndex });
      continue;
    }
    if (bullet) {
      flushPara();
      const content = t.slice(bullet[0].length).trim();
      const { lang, dir } = detectLang(content);
      const indent = line.match(/^\s*/)?.[0].length || 0;
      blocks.push({ index: index++, kind: "list_item", level: indent >= 2 ? 1 : 0, text: content, rawText: line, marker: bullet[1], lang, dir, sectionIndex: Math.max(sectionIndex, 0) });
      continue;
    }
    if (numbered) {
      flushPara();
      // Numbered items keep their number inside the text (numbers are content, not formatting).
      const { lang, dir } = detectLang(t);
      blocks.push({ index: index++, kind: "list_item", level: 0, text: t, rawText: line, marker: null, lang, dir, sectionIndex: Math.max(sectionIndex, 0) });
      continue;
    }
    if (isHeadingCandidate(line, lines[i + 1], lines[i - 1])) {
      flushPara();
      const isTopLevel = sectionIndex < 0 || (lines[i - 1] === undefined || lines[i - 1].trim() === "") && (lines[i + 1] === undefined || lines[i + 1].trim() === "");
      if (isTopLevel) sectionIndex++;
      const { lang, dir } = detectLang(t);
      blocks.push({ index: index++, kind: isTopLevel ? "heading" : "subheading", level: isTopLevel ? 1 : 2, text: t, rawText: line, marker: null, lang, dir, sectionIndex: Math.max(sectionIndex, 0) });
      continue;
    }
    paraBuffer.push(line);
  }
  flushPara();
  if (blocks.length === 0 && text.trim()) {
    const { lang, dir } = detectLang(text);
    blocks.push({ index: 0, kind: "paragraph", level: 0, text: text.trim(), rawText: text, marker: null, lang, dir, sectionIndex: 0 });
  }
  return blocks;
}

/** Normalize for comparison: collapse whitespace only. Wording/punctuation untouched. */
export function normalizeForCompare(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/** Split a block's text into fragments at sentence boundaries, never altering characters. */
export function splitIntoFragments(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?؟。\n]+[.!?؟。]*\s*|\n+/g) || [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > maxChars && cur) { out.push(cur); cur = s; }
    else cur += s;
    while (cur.length > maxChars) {
      // sentence itself too long: split at word boundary
      let cut = cur.lastIndexOf(" ", maxChars);
      if (cut <= 0) cut = maxChars;
      out.push(cur.slice(0, cut + 1));
      cur = cur.slice(cut + 1);
    }
  }
  if (cur) out.push(cur);
  // Fragments concatenated must equal the original text exactly.
  const joined = out.join("");
  if (joined !== text) return [text];
  return out;
}
