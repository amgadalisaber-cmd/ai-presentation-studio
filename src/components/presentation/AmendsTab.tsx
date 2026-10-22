"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { SlideView } from "@/components/slide/SlideView";
import { AmendsPanel } from "./AmendsPanel";
import { Spinner } from "@/components/ui";
import type { SlideModel } from "@/lib/types";

/** Presentation workspace tab: a chat for the whole deck plus one thread per slide. */
export function AmendsTab({ presentationId }: { presentationId: string }) {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideModel[] | null>(null); const [open, setOpen] = useState<string | null>(null);
  const load = async () => { const d = await api<{ slides: SlideModel[] }>(`/api/presentations/${presentationId}/slides`); setSlides(d.slides); };
  useEffect(() => { load(); }, [presentationId]);
  if (!slides) return <Spinner />;
  const refresh = async () => { await load(); router.refresh(); };
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <p className="muted text-sm">Every slide has its own amend thread. Click a slide to write amends for it alone; requests are interpreted into design operations, applied, and can be undone.</p>
        {slides.length === 0 && <p className="text-sm text-ink-500">Generate the presentation first.</p>}
        {slides.map((s) => (
          <div key={s.id} className={`card overflow-hidden ${open === s.id ? "border-accent" : ""}`}>
            <div className="grid grid-cols-[260px_1fr] gap-4 p-3 cursor-pointer" onClick={() => setOpen(open === s.id ? null : s.id!)}>
              <SlideView slide={s} className="rounded border border-ink-700" />
              <div className="text-sm"><div className="font-medium">Slide {s.index + 1} <span className="text-ink-500">· {s.purpose}</span></div><div className="mt-1 text-xs text-ink-500 line-clamp-3" dir="auto">{s.elements.filter((e) => e.type === "text" && e.blockId).map((e) => (e.props as { text: string }).text).join(" · ").slice(0, 240)}</div><div className="mt-2 text-xs text-accent">{open === s.id ? "Hide amends" : "Write amends for this slide"}</div></div>
            </div>
            {open === s.id && <div className="border-t border-ink-700"><AmendsPanel presentationId={presentationId} slideId={s.id!} slideLabel={`slide ${s.index + 1}`} onApplied={refresh} /></div>}
          </div>
        ))}
      </div>
      <div className="xl:sticky xl:top-0 self-start"><AmendsPanel presentationId={presentationId} slideId={null} slideLabel="whole presentation" onApplied={refresh} /></div>
    </div>
  );
}
