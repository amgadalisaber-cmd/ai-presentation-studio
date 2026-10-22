import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Editor } from "@/components/editor/Editor";
export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const p = await prisma.presentation.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!p) notFound();
  return <Editor presentationId={id} />;
}
