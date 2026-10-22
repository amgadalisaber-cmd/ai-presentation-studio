"use client";
import { useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, type SlideModel } from "@/lib/types";
import { renderSlideHtml } from "@/lib/render/html";

/** Non-interactive slide preview (thumbnails, proposals, play mode). Scales a full 1920x1080 render into its container. */
export function SlideView({ slide, className = "", onClick, width }: { slide: SlideModel; className?: string; onClick?: () => void; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const SW = slide.w || CANVAS_W, SH = slide.h || CANVAS_H;
  const [scale, setScale] = useState(width ? width / SW : 0.1);
  useEffect(() => {
    if (width) { setScale(width / SW); return; }
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / SW));
    ro.observe(el); setScale(el.clientWidth / SW);
    return () => ro.disconnect();
  }, [width, SW]);
  const html = renderSlideHtml(slide, (s) => s);
  return (
    <div ref={ref} className={`slide-frame ${className}`} onClick={onClick} style={{ aspectRatio: `${SW} / ${SH}`, ...(width ? { width, height: width * SH / SW } : {}) }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SW, height: SH }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
