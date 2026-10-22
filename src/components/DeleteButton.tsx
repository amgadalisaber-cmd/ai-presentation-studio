"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client";
export function DeleteButton({ url, label, confirmText, redirect }: { url: string; label: string; confirmText: string; redirect: string }) {
  const router = useRouter();
  return <button className="btn-danger btn-sm" onClick={async () => { if (!confirm(confirmText)) return; try { await api(url, { method: "DELETE" }); router.push(redirect); router.refresh(); } catch (e) { alert((e as Error).message); } }}><Trash2 size={13} /> {label}</button>;
}
