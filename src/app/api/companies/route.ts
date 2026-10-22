import { handler, parse } from "@/lib/api";
import { companySchema } from "./schema";
import { prisma } from "@/lib/db";


export const GET = handler(async (req, _p, userId) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const clientsOnly = url.searchParams.get("clients") === "1";
  return prisma.company.findMany({
    where: { userId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}), ...(clientsOnly ? { isClient: true } : {}) },
    orderBy: { updatedAt: "desc" }, take: 200,
    include: { assets: { where: { kind: { in: ["primary_logo", "secondary_logo", "logo_variation"] } }, orderBy: { createdAt: "asc" } }, _count: { select: { assets: true, participants: true, presentationCompanies: true } } },
  });
});

export const POST = handler(async (req, _p, userId) => {
  const body = await parse(req, companySchema);
  return prisma.company.create({ data: { ...body, userId, colors: body.colors ?? [], typography: body.typography ?? {} } });
});
