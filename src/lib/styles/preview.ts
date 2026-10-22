import { generateSlides } from "../generation/engine";
import type { StyleSpec } from "./spec";
import type { BlockModel, SlideModel } from "../types";

/** Sample slides used for style previews (client-safe: pure computation). */
export function previewSlides(spec: StyleSpec, styleName: string): SlideModel[] {
  const mk = (i: number, kind: BlockModel["kind"], text: string): BlockModel => ({ id: `p${i}`, index: i, kind, level: kind === "heading" ? 1 : 0, text, rawText: text, lang: "en", dir: "ltr", sectionIndex: 0 });
  const blocks: BlockModel[] = [
    mk(0, "heading", "Executive Summary"),
    mk(1, "paragraph", "Our regional expansion delivered 42% revenue growth in 2026, driven by three new markets and a refreshed product line. This plan sets out how we consolidate those gains."),
    mk(2, "heading", "Key Objectives"),
    mk(3, "list_item", "Enter two additional markets by Q3 2027"), mk(4, "list_item", "Increase recurring revenue share to 65%"), mk(5, "list_item", "Launch the creator platform with 25 partner studios"), mk(6, "list_item", "Reduce customer acquisition cost by 18%"),
  ];
  const slides = generateSlides({ presentationId: "preview", name: `${styleName} direction`, type: "Business Proposal", typeLabel: "Business Proposal", language: "en", blocks, spec, styleId: null, participants: [], presentedBy: [{ name: "Studio", showLogo: false }], presentedTo: [{ name: "Client", showLogo: false }], presentedByEnabled: true, presentedToEnabled: true, metadata: { date: "2027" }, aiImages: false });
  const pick: SlideModel[] = [];
  const take = (f: (s: SlideModel) => boolean) => { const s = slides.find((x) => f(x) && !pick.includes(x)); if (s) pick.push(s); };
  take((s) => s.purpose === "cover"); take((s) => s.purpose === "section"); take((s) => s.purpose === "content"); take((s) => s.purpose === "list");
  return pick.slice(0, 4);
}
