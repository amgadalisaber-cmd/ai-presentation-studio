import type { StyleSpec } from "../styles/spec";

export interface BrandColor { name?: string; hex: string; role?: string }

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a: string, b: string) { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
export function isDark(hex: string) { return luminance(hex) < 0.35; }
export function withAlpha(hex: string, alpha: number) { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }
export function mix(a: string, b: string, t: number) { const A = hexToRgb(a), B = hexToRgb(b); const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0"); return `#${c(A.r, B.r)}${c(A.g, B.g)}${c(A.b, B.b)}`; }

export interface ResolvedPalette { background: string; surface: string; text: string; muted: string; accent: string; accent2: string; dark: boolean; source: string }

/** Combines the style palette with the primary brand's colors according to the style's color behavior and user override. */
export function resolvePalette(spec: StyleSpec, brandColors: BrandColor[] | undefined, override: "auto" | "style" | "brand" = "auto"): ResolvedPalette {
  const p = spec.palette;
  const base: ResolvedPalette = { ...p, dark: isDark(p.background), source: "style" };
  const colors = (brandColors || []).filter((c) => c && /^#?[0-9a-fA-F]{3,6}$/.test(c.hex));
  if (!colors.length || override === "style") return base;
  const pick = (role: string) => colors.find((c) => (c.role || "").toLowerCase() === role)?.hex;
  const primary = pick("primary") || colors[0].hex;
  const secondary = pick("secondary") || pick("accent") || colors[1]?.hex;
  const norm = (h: string) => (h.startsWith("#") ? h : `#${h}`);
  const behavior = override === "brand" ? "brand-dominant" : spec.colorBehavior;
  if (behavior === "monochrome" || behavior === "style-dominant") return base;
  if (behavior === "brand-accent") {
    const accent = norm(primary);
    // Ensure accent is visible on background; otherwise fall back to style accent.
    const ok = contrastRatio(accent, p.background) >= 2.2;
    return { ...base, accent: ok ? accent : p.accent, accent2: secondary ? norm(secondary) : p.accent2, source: ok ? "brand-accent" : "style (brand accent lacks contrast)" };
  }
  // brand-dominant
  const bg = norm(primary);
  const dark = isDark(bg);
  const text = dark ? "#ffffff" : "#111111";
  const surface = dark ? mix(bg, "#ffffff", 0.08) : mix(bg, "#000000", 0.05);
  const acc = secondary ? norm(secondary) : p.accent;
  const accent = contrastRatio(acc, bg) >= 2 ? acc : (dark ? "#ffffff" : "#111111");
  return { background: bg, surface, text, muted: dark ? mix(bg, "#ffffff", 0.6) : mix(bg, "#000000", 0.5), accent, accent2: p.accent2, dark, source: "brand-dominant" };
}
