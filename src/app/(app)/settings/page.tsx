import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { imageProviderStatus } from "@/lib/images/nanobanana";
import { availableFonts } from "@/lib/render/fonts";
import { chromiumPath } from "@/lib/export/browser";
import { STORAGE_DIR } from "@/lib/storage";
import { SettingsForm } from "@/components/SettingsForm";
export default async function SettingsPage() {
  const user = await requireUser();
  const setting = await prisma.userSetting.findUnique({ where: { userId_key: { userId: user.id, key: "customTypes" } } });
  const img = imageProviderStatus(); const fonts = await availableFonts(); const chromium = chromiumPath();
  const row = (label: string, ok: boolean, detail: string) => <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span>{label}<span className="block text-xs text-ink-500">{detail}</span></span><span className={ok ? "badge-verified" : "badge-issues"}>{ok ? "Ready" : "Setup required"}</span></div>;
  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="h1">Settings & Integrations</h1>
      <section className="space-y-2"><h2 className="section-title">Integrations</h2><div className="card divide-y divide-ink-700">
        {row("Nano Banana Pro image generation", img.configured, img.configured ? `Configured (key ${img.keyHint}) · model ${img.model} · planning model ${img.textModel}` : `Set GEMINI_API_KEY in the server environment (.env) and restart. Model: ${img.model}. Keys never reach the browser.`)}
        {row("PDF rendering (Chromium)", !!chromium, chromium ? `Using ${chromium}` : "Set CHROMIUM_PATH to a Chromium/Chrome binary.")}
        {row("PostgreSQL database", true, "Connected via DATABASE_URL")}
        {row("File storage", true, `Local disk at ${STORAGE_DIR} (uploads, generated images, exports). Swap for object storage by replacing src/lib/storage.ts.`)}
        {row("Bundled fonts", fonts.every((f) => f.present), fonts.map((f) => `${f.family} ${f.weight}${f.present ? "" : " (missing)"}`).join(", ") + " — add more .ttf files to public/fonts and src/lib/render/fonts.ts")}
      </div></section>
      <section className="space-y-2"><h2 className="section-title">Presentation types</h2><p className="muted text-sm">Add custom presentation types available in the type dropdown.</p><SettingsForm customTypes={(setting?.value as string[]) || []} /></section>
      <section className="space-y-2"><h2 className="section-title">Account</h2><div className="card p-4 text-sm">{user.name} · {user.email}</div></section>
    </div>
  );
}
