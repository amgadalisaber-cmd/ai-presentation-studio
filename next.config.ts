import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "pptxgenjs", "@prisma/client", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};
export default nextConfig;
