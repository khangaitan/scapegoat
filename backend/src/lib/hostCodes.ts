import { db, hostCodesTable } from "../db/index.js";
import { and, eq, desc, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";

function genCode(): string {
  const raw = randomBytes(4).toString("hex").toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function generateHostCode(note?: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = genCode();
    try { await db.insert(hostCodesTable).values({ code, note: note ?? null }); return code; }
    catch { /* collision, retry */ }
  }
  throw new Error("Could not generate unique code");
}

export async function listHostCodes() {
  return db.select().from(hostCodesTable).orderBy(desc(hostCodesTable.createdAt)).limit(500);
}

export async function consumeHostCode(
  code: string, usedByName: string, roomId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Хост код оруулна уу" };
  const updated = await db.update(hostCodesTable)
    .set({ usedAt: new Date().toISOString(), usedByName, roomId })
    .where(and(eq(hostCodesTable.code, normalized), isNull(hostCodesTable.usedAt)))
    .returning({ code: hostCodesTable.code });
  if (updated.length > 0) return { ok: true };
  const existing = await db.select({ code: hostCodesTable.code }).from(hostCodesTable)
    .where(eq(hostCodesTable.code, normalized)).limit(1);
  if (existing.length === 0) return { ok: false, error: "Хост код буруу байна" };
  return { ok: false, error: "Энэ код хэрэглэгдсэн байна" };
}
