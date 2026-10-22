export function fmtDate(d: string | Date) { return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
export function fmtBytes(n: number) { return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`; }
