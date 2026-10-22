import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: { 950: "#0b0b0e", 900: "#121217", 800: "#1a1b22", 700: "#24252e", 600: "#30323d", 500: "#4a4c5a", 400: "#7a7d8e", 300: "#a9abb8", 200: "#d6d7de", 100: "#eeeef2" }, accent: { DEFAULT: "#e8c66b", dim: "#b8984a" } } } },
  plugins: [],
} satisfies Config;
