import { PrismaClient } from "@prisma/client";
import { seedStyles } from "../src/lib/setup";
const prisma = new PrismaClient();
seedStyles().then((n) => console.log(`Seeded built-in visual styles (${n} new).`)).finally(() => prisma.$disconnect());
