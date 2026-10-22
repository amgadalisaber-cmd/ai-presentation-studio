import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AssetManager } from "@/components/clients/AssetManager";
export default async function AssetsPage() {
  const user = await requireUser();
  const assets = await prisma.brandAsset.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { company: { select: { id: true, name: true } } } });
  return <div className="space-y-6"><div><h1 className="h1">Assets Library</h1><p className="muted text-sm mt-1">All uploaded logos, images, references, fonts and documents across clients. Uploads here are unassigned; upload inside a client profile to attach them to a brand.</p></div><AssetManager assets={assets.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))} showCompany /></div>;
}
