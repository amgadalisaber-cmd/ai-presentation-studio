import { normalizeForCompare } from "./parser";
import type { BlockModel, SlideModel, TextProps } from "../types";

export interface IntegrityIssue {
  severity: "error" | "warning" | "info";
  code: "missing" | "modified" | "duplicated" | "reordered" | "added_text" | "overflow" | "unresolved_image" | "unreadable";
  blockId?: string;
  blockIndex?: number;
  slideIndex?: number;
  elementId?: string;
  message: string;
  expected?: string;
  actual?: string;
}

export interface IntegrityReport {
  ok: boolean;               // no errors
  verified: boolean;         // ok && checkedAt set
  checkedAt: string;
  totalBlocks: number;
  matchedBlocks: number;
  issues: IntegrityIssue[];
  summary: { missing: number; modified: number; duplicated: number; reordered: number; addedText: number; warnings: number };
}

/**
 * Compares rendered slide text against the immutable source blocks.
 * Legitimate reflow (fragments across slides, whitespace) is accepted; wording changes are errors.
 */
export function verifyIntegrity(blocks: BlockModel[], slides: SlideModel[], extra: IntegrityIssue[] = []): IntegrityReport {
  const issues: IntegrityIssue[] = [...extra];
  const byBlock = new Map<string, { slideIndex: number; el: { id?: string; fragmentIndex: number; text: string } }[]>();
  const firstSlideOfBlock = new Map<string, number>();

  for (const slide of slides) {
    for (const el of slide.elements) {
      if (el.type !== "text") continue;
      const p = el.props as TextProps;
      if (el.blockId) {
        const arr = byBlock.get(el.blockId) || [];
        arr.push({ slideIndex: slide.index, el: { id: el.id, fragmentIndex: el.fragmentIndex ?? 0, text: p.text } });
        byBlock.set(el.blockId, arr);
        if (!firstSlideOfBlock.has(el.blockId)) firstSlideOfBlock.set(el.blockId, slide.index);
      } else if (el.origin === "user") {
        if (p.text.trim()) issues.push({ severity: "warning", code: "added_text", slideIndex: slide.index, elementId: el.id, message: `User-added text on slide ${slide.index + 1} is not part of the source content.`, actual: p.text.slice(0, 120) });
      } else if (el.origin === "content") {
        issues.push({ severity: "error", code: "added_text", slideIndex: slide.index, elementId: el.id, message: `Content text on slide ${slide.index + 1} has no source block mapping.`, actual: p.text.slice(0, 120) });
      }
    }
  }

  let matched = 0;
  for (const block of blocks) {
    const renders = byBlock.get(block.id);
    if (!renders || renders.length === 0) {
      issues.push({ severity: "error", code: "missing", blockId: block.id, blockIndex: block.index, message: `Block ${block.index + 1} (${block.kind}) is not rendered on any slide.`, expected: block.text.slice(0, 160) });
      continue;
    }
    // Group by fragment index; duplicates = same fragment rendered more than once
    const byFrag = new Map<number, typeof renders>();
    for (const r of renders) { const a = byFrag.get(r.el.fragmentIndex) || []; a.push(r); byFrag.set(r.el.fragmentIndex, a); }
    let dup = false;
    for (const [fi, arr] of byFrag) {
      if (arr.length > 1) { dup = true; issues.push({ severity: "error", code: "duplicated", blockId: block.id, blockIndex: block.index, slideIndex: arr[1].slideIndex, message: `Block ${block.index + 1} fragment ${fi + 1} is rendered ${arr.length} times.` }); }
    }
    const ordered = [...byFrag.keys()].sort((a, b) => a - b).map((k) => byFrag.get(k)![0]);
    // fragments must be in ascending slide order
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].slideIndex < ordered[i - 1].slideIndex) issues.push({ severity: "error", code: "reordered", blockId: block.id, blockIndex: block.index, message: `Fragments of block ${block.index + 1} appear out of order across slides.` });
    }
    const rendered = normalizeForCompare(ordered.map((o) => o.el.text).join(" "));
    const expected = normalizeForCompare(block.text);
    if (rendered === expected) { if (!dup) matched++; }
    else {
      issues.push({ severity: "error", code: "modified", blockId: block.id, blockIndex: block.index, slideIndex: ordered[0].slideIndex, message: `Block ${block.index + 1} text differs from the source.`, expected: expected.slice(0, 200), actual: rendered.slice(0, 200) });
    }
  }
  // Block order across slides must follow source order (first appearance)
  let lastSlide = -1, lastIndex = -1;
  for (const block of blocks) {
    const s = firstSlideOfBlock.get(block.id);
    if (s === undefined) continue;
    if (s < lastSlide) issues.push({ severity: "warning", code: "reordered", blockId: block.id, blockIndex: block.index, slideIndex: s, message: `Block ${block.index + 1} appears before block ${lastIndex + 1} in slide order (source order differs).` });
    if (s >= lastSlide) { lastSlide = s; lastIndex = block.index; }
  }

  const summary = {
    missing: issues.filter((i) => i.code === "missing").length,
    modified: issues.filter((i) => i.code === "modified").length,
    duplicated: issues.filter((i) => i.code === "duplicated").length,
    reordered: issues.filter((i) => i.code === "reordered" && i.severity === "error").length,
    addedText: issues.filter((i) => i.code === "added_text").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
  };
  const ok = !issues.some((i) => i.severity === "error");
  return { ok, verified: ok, checkedAt: new Date().toISOString(), totalBlocks: blocks.length, matchedBlocks: matched, issues, summary };
}
