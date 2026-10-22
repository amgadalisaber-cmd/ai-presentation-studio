"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Presentation, Building2, Palette, Images, History, Settings, LogOut, Plus } from "lucide-react";
import { api } from "@/lib/client";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presentations", label: "Presentations", icon: Presentation },
  { href: "/clients", label: "Clients & Brands", icon: Building2 },
  { href: "/styles", label: "Visual Styles", icon: Palette },
  { href: "/assets", label: "Assets Library", icon: Images },
  { href: "/history", label: "Generation History", icon: History },
  { href: "/settings", label: "Settings & Integrations", icon: Settings },
];

export function AppShell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const isEditor = /^\/presentations\/[^/]+\/editor/.test(path);
  return (
    <div className="flex h-screen overflow-hidden">
      {!isEditor && (
        <aside className="flex w-64 flex-none flex-col border-r border-ink-700 bg-white/80 backdrop-blur">
          <div className="px-5 py-5 border-b border-ink-700">
            <Link href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent text-white text-sm font-bold shadow-[0_4px_12px_rgba(59,130,246,0.35)]">AI</span><span><span className="block text-[10px] uppercase tracking-[0.2em] text-accent-dim">Studio</span><span className="block text-sm font-semibold tracking-tight">Presentation Studio</span></span></Link>
          </div>
          <div className="px-3 pt-4"><Link href="/presentations/new" className="btn-primary w-full"><Plus size={16} /> New presentation</Link></div>
          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {NAV.map((n) => { const Icon = n.icon; const active = n.href === "/" ? path === "/" : path.startsWith(n.href); return <Link key={n.href} href={n.href} className={`nav-link ${active ? "active" : ""}`}><Icon size={16} />{n.label}</Link>; })}
          </nav>
          <div className="border-t border-ink-700 px-4 py-3 text-xs">
            <div className="truncate font-medium text-ink-200">{user.name}</div><div className="truncate text-ink-500">{user.email}</div>
            <button className="btn-ghost btn-sm mt-2 -ml-2" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}><LogOut size={14} /> Sign out</button>
          </div>
        </aside>
      )}
      <main className={`flex-1 overflow-auto ${isEditor ? "" : "p-8"}`}>{children}</main>
    </div>
  );
}
