export type CoverLayout = "left-stack" | "centered" | "split" | "bottom-band" | "poster" | "grid";
export type ContentLayout = "two-column" | "single-column" | "sidebar" | "editorial" | "card-grid" | "full-bleed";
export type ImagePlacement = "right-half" | "left-half" | "full-bleed" | "top-band" | "inset" | "none";

export interface StyleSpec {
  fonts: { heading: string; body: string; arabicHeading: string; arabicBody: string; headingWeight: number; bodyWeight: number; headingTransform: "uppercase" | "none"; headingLetterSpacing: number };
  palette: { background: string; surface: string; text: string; muted: string; accent: string; accent2: string };
  /** how brand colors interact with the style palette */
  colorBehavior: "brand-accent" | "brand-dominant" | "style-dominant" | "monochrome";
  composition: { coverLayout: CoverLayout; contentLayout: ContentLayout; headingPlacement: "top" | "side" | "bottom"; alignment: "start" | "center"; imagePlacement: ImagePlacement; listStyle: "bullets" | "cards" | "numbered-rows" | "columns" };
  density: "airy" | "balanced" | "dense";
  scale: { h1: number; h2: number; h3: number; body: number; caption: number; lineHeight: number };
  decorative: { rules: boolean; slideNumbers: boolean; sectionNumbers: boolean; frames: boolean; gridLines: boolean; largeIndex: boolean; dividerStyle: "line" | "block" | "none"; logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" };
  background: { treatment: "solid" | "gradient" | "image-dark" | "image-light" | "paper" | "grid"; gradient?: string; overlay?: string };
  imageTreatment: { style: string; promptPrefix: string; negativePrompt: string; cssFilter?: string; aspect: "16:9" | "4:3" | "1:1" | "3:4" };
  lighting?: string;
  negative: string[];
  tone?: string;   // see TONES in types.ts
  voice?: string;  // free-text voice & personality description
}

export interface BuiltInStyle { key: string; tone: string; name: string; description: string; spec: StyleSpec; fields: { composition: string; layoutRules: string; typography: string; imageTreatment: string; backgroundTreatment: string; colorBehavior: string; lighting: string; density: string; decorative: string; negative: string } }

const AR_H = "Cairo", AR_B = "Cairo";

export const BUILT_IN_STYLES: BuiltInStyle[] = [
  {
    key: "cinematic", tone: "serious", name: "Cinematic", description: "Dark, atmospheric, widescreen compositions with full-bleed imagery, restrained type and dramatic negative space.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 300, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -1 },
      palette: { background: "#07080c", surface: "#12141c", text: "#f4f2ec", muted: "#9a9cab", accent: "#d8b56a", accent2: "#3b6ea5" },
      colorBehavior: "brand-accent",
      composition: { coverLayout: "bottom-band", contentLayout: "full-bleed", headingPlacement: "bottom", alignment: "start", imagePlacement: "full-bleed", listStyle: "numbered-rows" },
      density: "airy",
      scale: { h1: 112, h2: 68, h3: 40, body: 30, caption: 20, lineHeight: 1.45 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: true, frames: false, gridLines: false, largeIndex: false, dividerStyle: "line", logoPosition: "top-left" },
      background: { treatment: "image-dark", gradient: "linear-gradient(180deg, #0b0d14 0%, #05060a 100%)", overlay: "linear-gradient(90deg, rgba(5,6,10,0.92) 0%, rgba(5,6,10,0.55) 55%, rgba(5,6,10,0.15) 100%)" },
      imageTreatment: { style: "cinematic photography", promptPrefix: "Cinematic widescreen still, anamorphic lens, moody volumetric light, deep shadows, film grain, muted teal and amber grade, no text, no logos, no watermarks.", negativePrompt: "text, letters, typography, logo, watermark, cartoon, clip art, low quality", cssFilter: "contrast(1.05) saturate(0.85)", aspect: "16:9" },
      lighting: "Low-key, directional, volumetric haze.", negative: ["no bright white backgrounds", "no clip-art icons", "no dense bullet walls"],
    },
    fields: { composition: "Widescreen full-bleed imagery with text anchored to the lower third or left edge. Generous negative space.", layoutRules: "One idea per slide. Headlines bottom-left. Body in a single narrow column over a dark gradient.", typography: "Light-weight sans headlines at large scale, tight tracking. Arabic in Cairo with matching hierarchy.", imageTreatment: "Cinematic photography, anamorphic, moody light, teal/amber grade, heavy darkening overlay for legibility.", backgroundTreatment: "Near-black with image or subtle vertical gradient.", colorBehavior: "Brand color appears only as an accent (rules, numbers, highlights).", lighting: "Low-key, directional, volumetric haze.", density: "Airy — few words per slide; long content splits across slides.", decorative: "Thin accent rules, section numbers, slide counters.", negative: "No bright backgrounds, no clip-art, no dense bullet walls." },
  },
  {
    key: "modern-minimal", tone: "minimal", name: "Modern Minimal", description: "White space, precise grid, black type and a single accent. Imagery is inset and quiet.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 600, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -2 },
      palette: { background: "#ffffff", surface: "#f4f4f2", text: "#111111", muted: "#6b6b6b", accent: "#1a1a1a", accent2: "#d9d9d6" },
      colorBehavior: "brand-accent",
      composition: { coverLayout: "left-stack", contentLayout: "two-column", headingPlacement: "top", alignment: "start", imagePlacement: "inset", listStyle: "bullets" },
      density: "balanced",
      scale: { h1: 96, h2: 60, h3: 36, body: 28, caption: 18, lineHeight: 1.5 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: false, frames: false, gridLines: false, largeIndex: false, dividerStyle: "line", logoPosition: "top-left" },
      background: { treatment: "solid" },
      imageTreatment: { style: "minimal photography", promptPrefix: "Minimalist photograph, clean composition, soft natural light, neutral palette, lots of negative space, no text, no logos.", negativePrompt: "text, typography, logo, watermark, clutter, busy background", aspect: "4:3" },
      negative: ["no gradients", "no drop shadows", "no decorative icons"],
    },
    fields: { composition: "Strict 12-column grid, left-aligned, large margins.", layoutRules: "Heading top-left, body in two columns, images inset on the right third.", typography: "Semibold sans headlines, regular body, tight tracking.", imageTreatment: "Quiet, natural-light photography, inset with no borders.", backgroundTreatment: "Pure white.", colorBehavior: "Black type; brand primary used as the single accent.", lighting: "Soft, natural.", density: "Balanced.", decorative: "Hairline rules and slide numbers only.", negative: "No gradients, shadows or icons." },
  },
  {
    key: "bold-editorial", tone: "bold", name: "Bold Editorial", description: "Oversized headlines, high-contrast type pairing, asymmetric layouts and large numerals like a magazine feature.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 900, bodyWeight: 400, headingTransform: "uppercase", headingLetterSpacing: -3 },
      palette: { background: "#f3efe6", surface: "#e9e3d6", text: "#141210", muted: "#5d574c", accent: "#d6301d", accent2: "#141210" },
      colorBehavior: "style-dominant",
      composition: { coverLayout: "poster", contentLayout: "editorial", headingPlacement: "side", alignment: "start", imagePlacement: "left-half", listStyle: "numbered-rows" },
      density: "balanced",
      scale: { h1: 150, h2: 84, h3: 42, body: 28, caption: 18, lineHeight: 1.4 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: true, frames: false, gridLines: false, largeIndex: true, dividerStyle: "block", logoPosition: "top-right" },
      background: { treatment: "paper" },
      imageTreatment: { style: "editorial photography", promptPrefix: "Bold editorial magazine photograph, high contrast, strong graphic composition, punchy color, dramatic cropping, no text, no logos.", negativePrompt: "text, typography, logo, watermark, soft focus, stock-photo feel", cssFilter: "contrast(1.1)", aspect: "3:4" },
      negative: ["no centered layouts", "no pastel palettes", "no small timid headlines"],
    },
    fields: { composition: "Asymmetric, poster-like. Huge headlines bleed to edges; body text sits in narrow columns.", layoutRules: "Heading on the left half, body right; large index numerals for sections.", typography: "Black-weight uppercase sans headlines; small regular body.", imageTreatment: "High-contrast editorial photography, tight crops, left half of the slide.", backgroundTreatment: "Warm paper tone.", colorBehavior: "Style palette leads; brand colors appear in logos and small accents only.", lighting: "Hard, graphic.", density: "Balanced.", decorative: "Thick black rules, oversized section numbers.", negative: "No centered layouts, no pastels, no timid type." },
  },
  {
    key: "corporate-premium", tone: "professional", name: "Corporate Premium", description: "Polished navy-and-gold corporate language with structured grids, cards and restrained imagery.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 600, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -1 },
      palette: { background: "#0e1b2e", surface: "#16263d", text: "#ffffff", muted: "#aab6c8", accent: "#c9a85c", accent2: "#2f5f9e" },
      colorBehavior: "brand-dominant",
      composition: { coverLayout: "split", contentLayout: "card-grid", headingPlacement: "top", alignment: "start", imagePlacement: "right-half", listStyle: "cards" },
      density: "balanced",
      scale: { h1: 88, h2: 56, h3: 34, body: 26, caption: 18, lineHeight: 1.5 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: false, frames: true, gridLines: false, largeIndex: false, dividerStyle: "line", logoPosition: "top-right" },
      background: { treatment: "gradient", gradient: "linear-gradient(135deg, #0e1b2e 0%, #132742 100%)" },
      imageTreatment: { style: "corporate photography", promptPrefix: "Premium corporate photograph, modern architecture or professional environment, clean, cool tones with warm highlights, shallow depth of field, no text, no logos.", negativePrompt: "text, typography, logo, watermark, cartoon, cluttered", aspect: "16:9" },
      negative: ["no playful illustration", "no handwritten fonts"],
    },
    fields: { composition: "Structured grid with card modules and a split cover.", layoutRules: "Heading top; content in cards or two columns; imagery on the right half.", typography: "Semibold sans headlines; comfortable body size.", imageTreatment: "Premium corporate photography, cool tones, shallow depth of field.", backgroundTreatment: "Deep navy gradient; brand primary may replace navy.", colorBehavior: "Brand primary becomes the dominant surface color; gold accent kept.", lighting: "Clean, bright highlights.", density: "Balanced.", decorative: "Card frames, hairline rules, slide numbers.", negative: "No playful illustration, no handwriting fonts." },
  },
  {
    key: "swiss", tone: "technical", name: "Swiss International", description: "Grid-driven typographic layouts, flush-left ragged-right type, red accent, no ornament.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 700, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -2 },
      palette: { background: "#ffffff", surface: "#f0f0f0", text: "#000000", muted: "#555555", accent: "#e30613", accent2: "#000000" },
      colorBehavior: "style-dominant",
      composition: { coverLayout: "grid", contentLayout: "sidebar", headingPlacement: "side", alignment: "start", imagePlacement: "top-band", listStyle: "columns" },
      density: "dense",
      scale: { h1: 104, h2: 64, h3: 36, body: 26, caption: 16, lineHeight: 1.4 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: true, frames: false, gridLines: true, largeIndex: false, dividerStyle: "block", logoPosition: "bottom-left" },
      background: { treatment: "grid" },
      imageTreatment: { style: "black and white documentary", promptPrefix: "Black and white documentary photograph, objective, geometric composition, high clarity, no text, no logos.", negativePrompt: "text, typography, logo, watermark, color cast, soft focus", cssFilter: "grayscale(1) contrast(1.1)", aspect: "16:9" },
      negative: ["no centered text", "no gradients", "no decorative imagery"],
    },
    fields: { composition: "Modular grid with visible structure; type aligns to columns.", layoutRules: "Heading in a left sidebar column; body spans the remaining grid columns.", typography: "Bold flush-left sans headlines, ragged right.", imageTreatment: "Black-and-white documentary photographs in a top band.", backgroundTreatment: "White with faint grid.", colorBehavior: "Black, white and red. Brand colors only in logos.", lighting: "Neutral.", density: "Dense — more content per slide.", decorative: "Red blocks, grid lines, numbering.", negative: "No centered text, gradients or decorative imagery." },
  },
  {
    key: "luxury", tone: "luxurious", name: "Luxury", description: "Black and champagne, serif headlines, centered compositions, thin frames and abundant whitespace.",
    spec: {
      fonts: { heading: "Georgia", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 400, bodyWeight: 300, headingTransform: "none", headingLetterSpacing: 2 },
      palette: { background: "#0b0a09", surface: "#171513", text: "#efe6d6", muted: "#9c927f", accent: "#cdb27a", accent2: "#6e5c3a" },
      colorBehavior: "monochrome",
      composition: { coverLayout: "centered", contentLayout: "single-column", headingPlacement: "top", alignment: "center", imagePlacement: "inset", listStyle: "numbered-rows" },
      density: "airy",
      scale: { h1: 100, h2: 60, h3: 36, body: 28, caption: 18, lineHeight: 1.6 },
      decorative: { rules: true, slideNumbers: false, sectionNumbers: true, frames: true, gridLines: false, largeIndex: false, dividerStyle: "line", logoPosition: "top-left" },
      background: { treatment: "solid" },
      imageTreatment: { style: "luxury product photography", promptPrefix: "Luxury editorial photograph, dark background, champagne and black palette, soft rim light, refined textures, no text, no logos.", negativePrompt: "text, typography, logo, watermark, bright colors, clutter", cssFilter: "saturate(0.7)", aspect: "1:1" },
      negative: ["no bright saturated colors", "no bullet points with icons"],
    },
    fields: { composition: "Centered, symmetrical, framed.", layoutRules: "Centered heading, single narrow column, thin frame around the slide.", typography: "Serif headlines with wide tracking; light body.", imageTreatment: "Dark, refined product-style imagery, square inset.", backgroundTreatment: "Deep black.", colorBehavior: "Monochrome black/champagne; brand colors suppressed except logos.", lighting: "Soft rim light.", density: "Airy.", decorative: "Thin frames, centered rules, roman-style section numbers.", negative: "No saturated color, no icon bullets." },
  },
  {
    key: "futuristic", tone: "energetic", name: "Futuristic", description: "Deep space gradients, neon accent glow, geometric framing and technical captions.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 700, bodyWeight: 400, headingTransform: "uppercase", headingLetterSpacing: 4 },
      palette: { background: "#05070f", surface: "#0d1326", text: "#e9f1ff", muted: "#8ea0c4", accent: "#38e1ff", accent2: "#8b5cf6" },
      colorBehavior: "style-dominant",
      composition: { coverLayout: "centered", contentLayout: "card-grid", headingPlacement: "top", alignment: "center", imagePlacement: "full-bleed", listStyle: "cards" },
      density: "balanced",
      scale: { h1: 92, h2: 56, h3: 32, body: 26, caption: 16, lineHeight: 1.5 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: true, frames: true, gridLines: true, largeIndex: false, dividerStyle: "line", logoPosition: "top-left" },
      background: { treatment: "gradient", gradient: "radial-gradient(1200px 700px at 70% 20%, #16204a 0%, #05070f 60%)", overlay: "linear-gradient(180deg, rgba(5,7,15,0.3) 0%, rgba(5,7,15,0.85) 100%)" },
      imageTreatment: { style: "futuristic 3D render", promptPrefix: "Futuristic 3D render, sleek surfaces, neon cyan and violet glow, dark environment, volumetric light, ultra-detailed, no text, no logos.", negativePrompt: "text, typography, logo, watermark, retro, grunge", aspect: "16:9" },
      negative: ["no warm paper tones", "no serif fonts"],
    },
    fields: { composition: "Centered hero with geometric frames; grid cards for content.", layoutRules: "Centered uppercase headings, content in glowing cards.", typography: "Bold uppercase sans with wide tracking; technical captions.", imageTreatment: "Neon-lit 3D renders, full-bleed behind dark overlay.", backgroundTreatment: "Deep-space radial gradient with faint grid.", colorBehavior: "Style neon palette leads; brand colors in logos.", lighting: "Neon glow, volumetric.", density: "Balanced.", decorative: "Thin frames, corner marks, grid, numbering.", negative: "No warm paper tones, no serifs." },
  },
  {
    key: "technology", tone: "professional", name: "Technology-focused", description: "Clean product-tech look: light surfaces, blue accent, modular cards, diagrams-friendly spacing.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 700, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -1 },
      palette: { background: "#f7f9fc", surface: "#ffffff", text: "#0f172a", muted: "#64748b", accent: "#2563eb", accent2: "#0ea5e9" },
      colorBehavior: "brand-accent",
      composition: { coverLayout: "split", contentLayout: "card-grid", headingPlacement: "top", alignment: "start", imagePlacement: "right-half", listStyle: "cards" },
      density: "balanced",
      scale: { h1: 88, h2: 54, h3: 32, body: 26, caption: 17, lineHeight: 1.5 },
      decorative: { rules: false, slideNumbers: true, sectionNumbers: false, frames: true, gridLines: false, largeIndex: false, dividerStyle: "block", logoPosition: "top-left" },
      background: { treatment: "solid" },
      imageTreatment: { style: "technology product render", promptPrefix: "Clean technology product photograph or abstract 3D render, bright studio light, white and blue palette, precise, no text, no logos.", negativePrompt: "text, typography, logo, watermark, dark moody, grunge", aspect: "4:3" },
      negative: ["no dark heavy backgrounds", "no ornamental type"],
    },
    fields: { composition: "Modular card grid, rounded surfaces, split cover.", layoutRules: "Heading top-left; content as cards; imagery right half.", typography: "Bold sans headlines; neutral body.", imageTreatment: "Bright studio tech renders, blue/white.", backgroundTreatment: "Very light grey.", colorBehavior: "Brand primary as accent on cards and highlights.", lighting: "Bright studio.", density: "Balanced.", decorative: "Rounded card frames, slide numbers.", negative: "No dark backgrounds, no ornament." },
  },
  {
    key: "magazine", tone: "friendly", name: "Magazine Editorial", description: "Multi-column text, pull-quotes, captions and photo spreads reminiscent of a printed feature.",
    spec: {
      fonts: { heading: "Georgia", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 700, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -1 },
      palette: { background: "#fbfaf7", surface: "#f1efe9", text: "#1b1a18", muted: "#6c6861", accent: "#1f4e79", accent2: "#c2410c" },
      colorBehavior: "style-dominant",
      composition: { coverLayout: "split", contentLayout: "editorial", headingPlacement: "top", alignment: "start", imagePlacement: "left-half", listStyle: "columns" },
      density: "dense",
      scale: { h1: 96, h2: 58, h3: 34, body: 24, caption: 16, lineHeight: 1.5 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: false, frames: false, gridLines: false, largeIndex: false, dividerStyle: "line", logoPosition: "bottom-right" },
      background: { treatment: "paper" },
      imageTreatment: { style: "editorial photography", promptPrefix: "Editorial feature photograph, natural light, candid, rich detail, printed-magazine color, no text, no logos.", negativePrompt: "text, typography, logo, watermark, CGI look", aspect: "3:4" },
      negative: ["no neon", "no full-slide gradients"],
    },
    fields: { composition: "Spread-like layouts with columns and pull quotes.", layoutRules: "Serif headline top; body in two or three columns; photo on left half.", typography: "Serif headlines, sans body, small captions.", imageTreatment: "Candid editorial photography, printed-magazine color.", backgroundTreatment: "Off-white paper.", colorBehavior: "Editorial navy/orange; brand colors only in logos.", lighting: "Natural.", density: "Dense.", decorative: "Column rules, folios.", negative: "No neon, no full-slide gradients." },
  },
  {
    key: "data-driven", tone: "technical", name: "Data-driven", description: "Analytical, number-forward layouts with big figures, labels and structured rows.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 600, bodyWeight: 400, headingTransform: "none", headingLetterSpacing: -1 },
      palette: { background: "#101418", surface: "#1a2027", text: "#f1f5f9", muted: "#94a3b8", accent: "#22c55e", accent2: "#f59e0b" },
      colorBehavior: "brand-accent",
      composition: { coverLayout: "left-stack", contentLayout: "sidebar", headingPlacement: "top", alignment: "start", imagePlacement: "none", listStyle: "numbered-rows" },
      density: "dense",
      scale: { h1: 84, h2: 52, h3: 32, body: 25, caption: 16, lineHeight: 1.45 },
      decorative: { rules: true, slideNumbers: true, sectionNumbers: true, frames: false, gridLines: true, largeIndex: true, dividerStyle: "line", logoPosition: "top-right" },
      background: { treatment: "solid" },
      imageTreatment: { style: "abstract data visualization", promptPrefix: "Abstract data visualization artwork, glowing particles and lines on dark background, precise, no text, no numbers, no logos.", negativePrompt: "text, numbers, typography, logo, watermark, people", aspect: "16:9" },
      negative: ["no decorative photography", "no script fonts"],
    },
    fields: { composition: "Number-forward rows and sidebars.", layoutRules: "Heading top; rows of content with large index numbers; minimal imagery.", typography: "Semibold sans; figures emphasized.", imageTreatment: "Abstract data art only when requested.", backgroundTreatment: "Charcoal with faint grid.", colorBehavior: "Brand primary as accent color for highlights.", lighting: "Flat.", density: "Dense.", decorative: "Grid lines, index numerals, rules.", negative: "No decorative photos, no script fonts." },
  },
  {
    key: "experimental", tone: "playful", name: "Experimental", description: "Unexpected scale contrasts, rotated labels, off-grid placement and vivid color blocking.",
    spec: {
      fonts: { heading: "Inter", body: "Inter", arabicHeading: AR_H, arabicBody: AR_B, headingWeight: 800, bodyWeight: 400, headingTransform: "uppercase", headingLetterSpacing: -4 },
      palette: { background: "#1b1a2e", surface: "#2a2847", text: "#fdfcf7", muted: "#b7b3d6", accent: "#ff5c7a", accent2: "#ffd166" },
      colorBehavior: "style-dominant",
      composition: { coverLayout: "poster", contentLayout: "editorial", headingPlacement: "bottom", alignment: "start", imagePlacement: "inset", listStyle: "cards" },
      density: "airy",
      scale: { h1: 160, h2: 80, h3: 40, body: 28, caption: 18, lineHeight: 1.35 },
      decorative: { rules: false, slideNumbers: true, sectionNumbers: true, frames: false, gridLines: false, largeIndex: true, dividerStyle: "block", logoPosition: "bottom-left" },
      background: { treatment: "solid" },
      imageTreatment: { style: "surreal collage", promptPrefix: "Surreal art-direction collage, bold color blocking, unexpected scale, graphic shapes, no text, no logos.", negativePrompt: "text, typography, logo, watermark, corporate stock photo", aspect: "1:1" },
      negative: ["no conventional corporate templates"],
    },
    fields: { composition: "Off-grid, scale contrasts, color blocking.", layoutRules: "Huge headline bottom; body offset; rotated labels.", typography: "Heavy uppercase display sans.", imageTreatment: "Surreal collage inset.", backgroundTreatment: "Deep violet with color blocks.", colorBehavior: "Vivid style palette; brand colors in logos.", lighting: "Flat graphic.", density: "Airy.", decorative: "Color blocks, oversized numerals, rotated labels.", negative: "No conventional corporate templates." },
  },
];

export const DEFAULT_SPEC: StyleSpec = BUILT_IN_STYLES[1].spec;

/** Deep-merge a partial spec (user custom style) over the default spec. */
export function normalizeSpec(input: unknown): StyleSpec {
  const src = (input && typeof input === "object" ? input : {}) as Partial<StyleSpec>;
  const d = DEFAULT_SPEC;
  return {
    fonts: { ...d.fonts, ...(src.fonts || {}) },
    palette: { ...d.palette, ...(src.palette || {}) },
    colorBehavior: src.colorBehavior || d.colorBehavior,
    composition: { ...d.composition, ...(src.composition || {}) },
    density: src.density || d.density,
    scale: { ...d.scale, ...(src.scale || {}) },
    decorative: { ...d.decorative, ...(src.decorative || {}) },
    background: { ...d.background, ...(src.background || {}) },
    imageTreatment: { ...d.imageTreatment, ...(src.imageTreatment || {}) },
    lighting: src.lighting ?? d.lighting,
    negative: Array.isArray(src.negative) ? src.negative : d.negative,
    tone: src.tone || undefined,
    voice: src.voice || undefined,
  };
}
