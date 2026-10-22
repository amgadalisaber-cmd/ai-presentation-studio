import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["playwright-core", "pptxgenjs", "@prisma/client", "mammoth", "@sparticuz/chromium"],
  outputFileTracingIncludes: { "/api/**": ["./public/fonts/**", "./prisma/schema.sql"], "/status": ["./prisma/schema.sql"] },
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};
export default nextConfig;
