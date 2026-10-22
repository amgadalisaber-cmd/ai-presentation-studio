import { PrismaClient } from "@prisma/client";
import { BUILT_IN_STYLES } from "../src/lib/styles/spec";
const prisma = new PrismaClient();
async function main() {
  for (const s of BUILT_IN_STYLES) {
    const existing = await prisma.visualStyle.findFirst({ where: { isBuiltIn: true, name: s.name } });
    const data = { name: s.name, description: s.description, isBuiltIn: true, spec: { ...s.spec, tone: s.tone } as object, tone: s.tone, ...s.fields };
    if (existing) await prisma.visualStyle.update({ where: { id: existing.id }, data });
    else await prisma.visualStyle.create({ data });
  }
  console.log(`Seeded ${BUILT_IN_STYLES.length} built-in visual styles.`);
}
main().finally(() => prisma.$disconnect());
