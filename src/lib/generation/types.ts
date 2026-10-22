import type { StyleSpec } from "../styles/spec";
import type { BlockModel } from "../types";

export interface LogoRef { assetId: string; width: number; height: number; mime: string }
export interface BrandProfile {
  id: string; name: string;
  colors: { name?: string; hex: string; role?: string }[];
  typography: { headingFont?: string; bodyFont?: string; arabicHeadingFont?: string; arabicBodyFont?: string };
  logo?: LogoRef | null;
  images: LogoRef[];              // approved product images / photos usable as non-generated visuals
  guidelines: { category: string; rule: string }[];
}
export interface ParticipantCtx { brand: BrandProfile; role: string; roleLabel?: string | null; instructions?: string | null }
export interface CompanyEntry { name: string; title?: string | null; contactName?: string | null; department?: string | null; logo?: LogoRef | null; showLogo: boolean }

export interface PresentationMeta {
  date?: string; version?: string; preparedBy?: string; confidentiality?: string; projectName?: string; referenceNumber?: string;
  custom?: { label: string; value: string }[];
  colorMode?: "auto" | "style" | "brand";
}

export interface GenContext {
  presentationId: string;
  name: string;
  type: string;
  typeLabel: string;
  language: string;             // ar | en | ar-en | other
  blocks: BlockModel[];
  spec: StyleSpec;
  styleId: string | null;
  participants: ParticipantCtx[];
  presentedBy: CompanyEntry[];
  presentedTo: CompanyEntry[];
  presentedByEnabled: boolean;
  presentedToEnabled: boolean;
  metadata: PresentationMeta;
  aiImages: boolean;
  customDirection?: string | null;
  /** AI plan hints (optional): block grouping & emphasis; validated to reference every block exactly once */
  plan?: PlanHints | null;
}

export interface PlanHints {
  groups: { blockIds: string[]; purpose?: "content" | "list" | "quote" | "number"; imageConcept?: string }[];
}

export interface TypeProfile { sectionDividers: boolean; imageFrequency: "high" | "medium" | "low" | "none"; subtitle: boolean; closing: boolean; emphasizeNumbers: boolean }

export const PRESENTATION_TYPES = [
  "Corporate Presentation", "Company Profile", "Business Proposal", "Pitch Deck", "Marketing Strategy", "Creative Strategy", "Campaign Presentation", "Brand Strategy", "Brand Identity Presentation", "Media Plan", "Performance Report", "Case Study", "Product Presentation", "Sales Presentation", "Technical Presentation", "Investor Presentation", "Event Presentation", "Educational Presentation", "Workshop Presentation", "Research Presentation", "Portfolio Presentation", "Custom",
];

export function typeProfile(type: string): TypeProfile {
  const t = type.toLowerCase();
  const base: TypeProfile = { sectionDividers: true, imageFrequency: "medium", subtitle: true, closing: true, emphasizeNumbers: false };
  if (/performance|media plan|research|technical|report/.test(t)) return { ...base, sectionDividers: false, imageFrequency: "low", emphasizeNumbers: true };
  if (/pitch|investor|campaign|creative|brand identity|portfolio|event/.test(t)) return { ...base, imageFrequency: "high" };
  if (/educational|workshop/.test(t)) return { ...base, sectionDividers: true, imageFrequency: "low" };
  if (/company profile|product/.test(t)) return { ...base, imageFrequency: "high", sectionDividers: true };
  return base;
}
