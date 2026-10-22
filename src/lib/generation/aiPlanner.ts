import { generateJson } from "../images/nanobanana";
import type { BlockModel } from "../types";
import type { PlanHints } from "./types";

/**
 * Optional AI-assisted structure planning. The model only groups existing block IDs into slides and
 * proposes image concepts. It never sees a way to alter the text: output is validated so that every
 * block appears exactly once, in source order; otherwise the deterministic planner is used.
 */
export async function aiPlan(blocks: BlockModel[], typeLabel: string, styleName: string): Promise<{ plan: PlanHints | null; note: string }> {
  if (!process.env.GEMINI_API_KEY) return { plan: null, note: "AI planner skipped (no GEMINI_API_KEY); deterministic planner used." };
  const list = blocks.map((b) => `${b.id} | ${b.kind}${b.level ? b.level : ""} | ${b.text.replace(/\s+/g, " ").slice(0, 140)}`).join("\n");
  const prompt = `You are planning the slide structure of a "${typeLabel}" presentation designed in the "${styleName}" visual style.
Group the following content blocks (id | kind | preview) into slide groups. Rules:
- Keep the original order. Every block id must appear exactly once. Do not invent, drop, merge or rewrite blocks.
- Start a new group at each heading. Keep list items that belong together in one group when possible.
- For each group propose a short, concrete image concept (a scene or object) suitable for an AI image, with no text in the image.
Blocks:\n${list}`;
  try {
    const out = await generateJson<{ groups: { blockIds: string[]; imageConcept?: string }[] }>(prompt, `{"groups":[{"blockIds":["id"],"imageConcept":"string"}]}`);
    if (!out?.groups?.length) return { plan: null, note: "AI planner returned nothing usable; deterministic planner used." };
    const ids = blocks.map((b) => b.id);
    const flat = out.groups.flatMap((g) => g.blockIds || []);
    const valid = flat.length === ids.length && flat.every((id, i) => id === ids[i]);
    if (!valid) return { plan: null, note: "AI plan rejected (block set/order mismatch); deterministic planner used." };
    return { plan: { groups: out.groups.map((g) => ({ blockIds: g.blockIds, imageConcept: g.imageConcept?.slice(0, 300) })) }, note: "AI planner grouped blocks (structure only)." };
  } catch (e) {
    return { plan: null, note: `AI planner unavailable (${(e as Error).message.slice(0, 120)}); deterministic planner used.` };
  }
}
