export const maxDuration = 120;
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { initializeDatabase, tablesExist } from "@/lib/setup";
/** Initializes an EMPTY database (creates tables + seeds styles). Refuses once a user account exists, so it cannot be abused later. */
export async function POST() {
  try {
    if (await tablesExist()) { const users = await prisma.user.count().catch(() => 0); if (users > 0) return NextResponse.json({ error: "Database already initialized." }, { status: 409 }); }
    const seeded = await initializeDatabase();
    return NextResponse.json({ ok: true, seededStyles: seeded });
  } catch (e) { return NextResponse.json({ error: (e as Error).message.replace(/postgres(ql)?:\/\/\S+/gi, "postgresql://…") }, { status: 500 }); }
}
