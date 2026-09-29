import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { generations, type Generation, type GenerationType } from "../schema";

export async function insertGeneration(
  values: Omit<Generation, "createdAt"> & { createdAt?: Date },
): Promise<Generation> {
  const [row] = await getDb().insert(generations).values(values).returning();
  return row!;
}

export async function listGenerations(
  userId: string,
  type?: GenerationType,
  limit = 50,
): Promise<Generation[]> {
  return getDb()
    .select()
    .from(generations)
    .where(and(eq(generations.userId, userId), type ? eq(generations.type, type) : undefined))
    .orderBy(desc(generations.createdAt))
    .limit(limit);
}

export async function getGeneration(userId: string, id: string): Promise<Generation | undefined> {
  const [row] = await getDb()
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)));
  return row;
}

export async function updateGenerationOutput(
  userId: string,
  id: string,
  output: string,
): Promise<boolean> {
  const rows = await getDb()
    .update(generations)
    .set({ output })
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .returning({ id: generations.id });
  return rows.length > 0;
}
