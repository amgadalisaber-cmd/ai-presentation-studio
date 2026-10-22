import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    // Neutral scale is "inverted" relative to the old dark theme: 950 = page background, 100 = primary text.
    colors: {
      ink: { 950: "#f5f8fc", 900: "#ffffff", 800: "#eef4fa", 700: "#e2e9f1", 600: "#cfd9e5", 500: "#8593a5", 400: "#64748b", 300: "#475569", 200: "#334155", 100: "#0f172a" },
      accent: { DEFAULT: "#3b82f6", dim: "#2563eb", soft: "#dbeafe", light: "#60a5fa" },
    },
    boxShadow: { card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(37, 99, 235, 0.06)", pop: "0 12px 40px rgba(15, 23, 42, 0.12)" },
    borderRadius: { xl: "14px", "2xl": "20px" },
  } },
  plugins: [],
} satisfies Config;
