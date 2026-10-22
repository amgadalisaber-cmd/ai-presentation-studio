import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PresentationSetup, emptySetup } from "@/components/presentation/PresentationSetup";
export default async function NewPresentationPage() {
  const user = await requireUser();
  const styles = await prisma.visualStyle.findMany({ where: { OR: [{ userId: user.id }, { isBuiltIn: true }] }, orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }], select: { id: true, name: true, isBuiltIn: true, description: true, spec: true, tone: true } });
  const setting = await prisma.userSetting.findUnique({ where: { userId_key: { userId: user.id, key: "customTypes" } } });
  return (<div className="space-y-6"><div><h1 className="h1">Create a new presentation</h1><p className="muted text-sm mt-1">Supply the content, select the brands involved, configure the visual direction. Your wording is never changed.</p></div><PresentationSetup initial={emptySetup} styles={styles} customTypes={(setting?.value as string[]) || []} /></div>);
}
