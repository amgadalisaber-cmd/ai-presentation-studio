import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["playwright-core", "pptxgenjs", "@prisma/client", "mammoth", "@sparticuz/chromium", "tesseract.js", "tesseract.js-core", "jimp", "pdf-parse", "cheerio"],
  outputFileTracingIncludes: { "/api/**": ["./public/fonts/**", "./public/tessdata/**", "./prisma/schema.sql", "./node_modules/tesseract.js-core/**"], "/status": ["./prisma/schema.sql"] },
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};
export default nextConfig;
