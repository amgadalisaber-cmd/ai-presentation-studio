import { PrismaClient } from "@prisma/client";
import { initializeDatabase, tablesExist } from "../src/lib/setup";
const prisma = new PrismaClient();
(async () => {
  console.log("tables before:", await tablesExist());
  const n = await initializeDatabase();
  console.log("tables after:", await tablesExist(), "| styles seeded:", n, "| count:", await prisma.visualStyle.count(), "| users:", await prisma.user.count());
  await prisma.$disconnect();
})().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
