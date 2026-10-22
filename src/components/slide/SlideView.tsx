"use client";
import { useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, type SlideModel } from "@/lib/types";
import { renderSlideHtml } from "@/lib/render/html";

/** Non-interactive slide preview (thumbnails, proposals, play mode). Scales a full 1920x1080 render into its container. */
export function SlideView({ slide, className = "", onClick, width }: { slide: SlideModel; className?: string; onClick?: () => void; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(width ? width / CANVAS_W : 0.1);
  useEffect(() => {
    if (width) { setScale(width / CANVAS_W); return; }
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / CANVAS_W));
    ro.observe(el); setScale(el.clientWidth / CANVAS_W);
    return () => ro.disconnect();
  }, [width]);
  const html = renderSlideHtml(slide, (s) => s);
  return (
    <div ref={ref} className={`slide-frame ${className}`} onClick={onClick} style={width ? { width, height: width * CANVAS_H / CANVAS_W } : undefined}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CANVAS_W, height: CANVAS_H }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
