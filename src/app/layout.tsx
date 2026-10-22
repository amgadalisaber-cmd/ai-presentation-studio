import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "AI Presentation Studio", description: "Professional client presentations: one content source, many visual directions, zero unauthorized content changes." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
