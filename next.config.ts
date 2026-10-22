import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["playwright-core", "pptxgenjs", "@prisma/client", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};
export default nextConfig;
