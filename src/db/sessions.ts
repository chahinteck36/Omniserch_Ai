import { desc, eq, or } from 'drizzle-orm';
import { db } from './index.ts';
import { researchSessions } from './schema.ts';

export async function createResearchSessionDb(
  sessionId: string,
  query: string,
  mode: string,
  userEmail?: string,
  userUid?: string
) {
  try {
    const result = await db
      .insert(researchSessions)
      .values({
        sessionId,
        query,
        mode,
        userEmail: userEmail?.toLowerCase() || null,
        userUid: userUid || null,
        status: 'in_progress',
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to create research session in DB:', error);
    throw new Error('Database insert failed. Please try again later.', { cause: error });
  }
}

export async function updateResearchSessionDb(
  sessionId: string,
  status: 'completed' | 'failed' | 'in_progress',
  resultJson?: string,
  errorMessage?: string
) {
  try {
    const result = await db
      .update(researchSessions)
      .set({
        status,
        resultJson: resultJson || null,
        errorMessage: errorMessage || null,
        updatedAt: new Date(),
      })
      .where(eq(researchSessions.sessionId, sessionId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to update research session in DB:', error);
    throw new Error('Database update failed. Please try again later.', { cause: error });
  }
}

export async function getResearchSessionDb(sessionId: string) {
  try {
    const rows = await db
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.sessionId, sessionId))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get research session from DB:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserResearchSessionsDb(userEmail?: string, userUid?: string) {
  try {
    if (!userEmail && !userUid) return [];

    let conditions = [];
    if (userEmail) conditions.push(eq(researchSessions.userEmail, userEmail.toLowerCase()));
    if (userUid) conditions.push(eq(researchSessions.userUid, userUid));

    return await db
      .select()
      .from(researchSessions)
      .where(or(...conditions))
      .orderBy(desc(researchSessions.createdAt))
      .limit(50);
  } catch (error) {
    console.error('Failed to get user research sessions from DB:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
