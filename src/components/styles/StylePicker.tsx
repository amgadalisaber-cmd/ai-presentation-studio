"use client";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { SlideView } from "@/components/slide/SlideView";
import { previewSlides } from "@/lib/styles/preview";
import { normalizeSpec } from "@/lib/styles/spec";

export type PickerStyle = { id: string; name: string; isBuiltIn: boolean; description?: string | null; spec?: unknown; tone?: string | null };

/** Visual style chooser with live preview thumbnails. Single selection, or exactly `max` selections. */
export function StylePicker({ styles, value, onChange, max = 1, orientation = "landscape", tone, compact }: { styles: PickerStyle[]; value: string[]; onChange: (ids: string[]) => void; max?: number; orientation?: "landscape" | "portrait"; tone?: string; compact?: boolean }) {
  const previews = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, previewSlides(normalizeSpec(s.spec), s.name, orientation, tone).slice(0, 2)])), [styles, orientation, tone]);
  const toggle = (id: string) => {
    if (max === 1) return onChange(value[0] === id ? [] : [id]);
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    if (value.length >= max) return onChange([...value.slice(1), id]);
    onChange([...value, id]);
  };
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"}`}>
      {styles.map((s) => { const sel = value.includes(s.id); const order = value.indexOf(s.id); return (
        <button type="button" key={s.id} onClick={() => toggle(s.id)} className={`card overflow-hidden text-left transition-colors hover:border-ink-500 ${sel ? "border-accent ring-1 ring-accent/50" : ""}`}>
          <div className={`grid gap-px bg-ink-700 ${orientation === "portrait" ? "grid-cols-2" : "grid-cols-1"}`}>{previews[s.id].map((sl, i) => <SlideView key={i} slide={sl} />)}</div>
          <div className="p-2.5"><div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium truncate">{s.name}</span>{sel && <span className="flex-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[11px] font-semibold">{max > 1 ? order + 1 : <Check size={12} />}</span>}</div><div className="text-[11px] text-ink-500 truncate">{s.tone ? `${s.tone} · ` : ""}{s.isBuiltIn ? "built-in" : "custom"}{s.description ? ` · ${s.description}` : ""}</div></div>
        </button>); })}
    </div>
  );
}
