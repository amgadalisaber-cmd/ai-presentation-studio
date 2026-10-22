export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

export type Dir = "ltr" | "rtl";
export type Lang = "ar" | "en" | "mixed" | "neutral";

export interface TextProps {
  text: string;
  fontFamily: string;
  fontSize: number;       // px on the 1920x1080 canvas
  fontWeight: number;
  color: string;
  align: "left" | "right" | "center";
  dir: Dir;
  lang: Lang;
  lineHeight: number;     // multiplier
  letterSpacing?: number; // px
  textTransform?: "uppercase" | "none";
  valign?: "top" | "middle" | "bottom";
  bullet?: boolean;
  bulletChar?: string;
  marker?: string;
  italic?: boolean;
  opacity?: number;
  role?: "h1" | "h2" | "h3" | "body" | "caption" | "label" | "number" | "quote";
}
export interface ShapeProps { shape: "rect" | "ellipse" | "line"; fill?: string; stroke?: string; strokeWidth?: number; radius?: number; opacity?: number; gradient?: string }
export interface ImageProps { src?: string; fit: "cover" | "contain"; opacity?: number; radius?: number; placeholder?: boolean; alt?: string; cssFilter?: string; concept?: string }

export type ElementOrigin = "content" | "metadata" | "participant" | "decoration" | "user" | "ai_image";

export interface ElementModel {
  id?: string;
  type: "text" | "image" | "shape" | "logo";
  origin: ElementOrigin;
  x: number; y: number; w: number; h: number; z: number; rotation?: number;
  props: TextProps | ShapeProps | ImageProps;
  blockId?: string | null;
  fragmentIndex?: number | null;
  fragmentCount?: number | null;
  assetId?: string | null;
  generatedImageId?: string | null;
}

export interface SlideBackground { color?: string; gradient?: string; imageSrc?: string; imageAssetId?: string; generatedImageId?: string; overlay?: string; cssFilter?: string }

export interface SlideModel {
  id?: string;
  index: number;
  layoutKey: string;
  purpose: "cover" | "section" | "content" | "list" | "quote" | "participants" | "closing" | "image" | "number";
  background: SlideBackground;
  styleId?: string | null;
  elements: ElementModel[];
  imageRequest?: { concept: string; prompt: string; placement: "background" | "element"; elementKey?: string } | null;
  notes?: string;
}

export interface BlockModel {
  id: string;
  index: number;
  kind: "heading" | "subheading" | "paragraph" | "list_item" | "quote" | "number";
  level: number;
  text: string;
  rawText: string;
  marker?: string | null;
  lang: Lang;
  dir: Dir;
  sectionIndex: number;
}
