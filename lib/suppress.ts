import { and, eq, inArray } from "drizzle-orm";
import { db, suppressions, type Suppression } from "./db";
import { newSuppressionId } from "./id";

export async function suppressedAmong(
  userId: string,
  addresses: string[],
): Promise<string[]> {
  if (addresses.length === 0) return [];
  const lower = addresses.map((a) => a.toLowerCase());
  const rows = await db
    .select({ email: suppressions.email })
    .from(suppressions)
    .where(
      and(eq(suppressions.userId, userId), inArray(suppressions.email, lower)),
    );
  return rows.map((r) => r.email);
}

export async function addSuppression(
  userId: string,
  email: string,
  reason: Suppression["reason"],
): Promise<void> {
  await db
    .insert(suppressions)
    .values({
      id: newSuppressionId(),
      userId,
      email: email.toLowerCase(),
      reason,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
}
