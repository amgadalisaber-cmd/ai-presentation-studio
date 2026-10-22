"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Field } from "@/components/ui";
export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api(`/api/auth/${mode}`, { method: "POST", json: form }); router.push("/"); router.refresh(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card shadow-pop w-full max-w-sm p-7 space-y-4">
        <div><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent text-white font-bold mb-3">AI</span><h1 className="h1">Presentation Studio</h1><p className="muted text-sm mt-1">{mode === "setup" ? "Create the workspace owner account." : "Sign in to your workspace."}</p></div>
        {error && <Alert kind="error">{error}</Alert>}
        {mode === "setup" && <Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>}
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" hint={mode === "setup" ? "At least 8 characters." : undefined}><input className="input" type="password" required minLength={mode === "setup" ? 8 : 1} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{mode === "setup" ? "Create workspace" : "Sign in"}</button>
      </form>
    </div>
  );
}
