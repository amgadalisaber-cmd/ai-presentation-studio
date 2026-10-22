"use client";
export { fmtDate, fmtBytes } from "./format";
export class ClientError extends Error { status: number; details?: unknown; constructor(status: number, message: string, details?: unknown) { super(message); this.status = status; this.details = details; } }
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> || {}) };
  let body = init?.body;
  if (init?.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(init.json); }
  const res = await fetch(url, { ...init, headers, body, cache: "no-store" });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new ClientError(res.status, (data && data.error) || `Request failed (${res.status})`, data?.details);
  return data as T;
}
export async function upload<T = unknown>(url: string, fields: Record<string, string | Blob | undefined>): Promise<T> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v);
  return api<T>(url, { method: "POST", body: fd });
}
