import { and, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { activationCodes, userQuotas } from './schema.ts';

export async function getAllLicensesDb() {
  try {
    return await db.select().from(activationCodes);
  } catch (error) {
    console.error('Failed to get licenses from DB:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getLicenseByCodeDb(code: string) {
  try {
    const result = await db
      .select()
      .from(activationCodes)
      .where(eq(activationCodes.code, code.toUpperCase()))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Failed to get license by code from DB:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function insertLicenseDb(
  code: string,
  tier: 'pro' | 'enterprise',
  duration: '1_month' | '3_months' | '1_year' | 'lifetime',
  note?: string
) {
  try {
    const result = await db
      .insert(activationCodes)
      .values({
        code,
        tier,
        duration,
        note: note?.trim() || null,
        isUsed: false,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert license in DB:', error);
    throw new Error('Database insert failed. Please try again later.', { cause: error });
  }
}

export async function deleteLicenseDb(code: string) {
  try {
    const result = await db
      .delete(activationCodes)
      .where(eq(activationCodes.code, code.toUpperCase()))
      .returning();
    return result.length > 0;
  } catch (error) {
    console.error('Failed to delete license from DB:', error);
    throw new Error('Database delete failed. Please try again later.', { cause: error });
  }
}

export async function redeemLicenseDb(
  code: string,
  userEmail: string,
  userUid?: string
) {
  try {
    const target = await db
      .select()
      .from(activationCodes)
      .where(eq(activationCodes.code, code.toUpperCase()))
      .limit(1);

    if (target.length === 0) {
      return { success: false, message: 'License code not found or invalid' };
    }

    const row = target[0];
    if (row.isUsed) {
      return {
        success: false,
        message: 'This license code was already redeemed and cannot be reused or renewed.',
      };
    }

    const now = new Date();
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (row.duration === '3_months') durationMs = 90 * 24 * 60 * 60 * 1000;
    if (row.duration === '1_year') durationMs = 365 * 24 * 60 * 60 * 1000;
    if (row.duration === 'lifetime') durationMs = 100 * 365 * 24 * 60 * 60 * 1000;

    const expiresAt = new Date(now.getTime() + durationMs);

    const updated = await db
      .update(activationCodes)
      .set({
        isUsed: true,
        usedByEmail: userEmail.toLowerCase(),
        usedByUid: userUid || null,
        usedAt: now,
        expiresAt,
      })
      .where(and(eq(activationCodes.id, row.id), eq(activationCodes.isUsed, false)))
      .returning();

    if (!updated || updated.length === 0) {
      return {
        success: false,
        message: 'This license code was already redeemed and cannot be reused or renewed.',
      };
    }

    return {
      success: true,
      license: updated[0],
      expiresAtMs: expiresAt.getTime(),
    };
  } catch (error) {
    console.error('Failed to redeem license in DB:', error);
    throw new Error('Database transaction failed. Please try again later.', { cause: error });
  }
}

export async function getAuthoritativeQuotaDb(
  identifier: string,
  identifierType: 'email' | 'ip',
  totalLimit: number = 10
) {
  try {
    const existing = await db
      .select()
      .from(userQuotas)
      .where(eq(userQuotas.identifier, identifier))
      .limit(1);

    const used = existing.length > 0 ? existing[0].usedCount : 0;
    return {
      used,
      total: totalLimit,
      isExhausted: used >= totalLimit,
    };
  } catch (error) {
    console.error('Failed to get quota from DB:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function consumeAuthoritativeQuotaDb(
  identifier: string,
  identifierType: 'email' | 'ip',
  totalLimit: number = 10
) {
  try {
    // Ensure quota record exists initially
    await db
      .insert(userQuotas)
      .values({
        identifier,
        identifierType,
        usedCount: 0,
        totalLimit,
      })
      .onConflictDoNothing();

    // Atomic update only when usedCount < totalLimit
    const updated = await db
      .update(userQuotas)
      .set({
        usedCount: sql`${userQuotas.usedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(userQuotas.identifier, identifier), sql`${userQuotas.usedCount} < ${userQuotas.totalLimit}`))
      .returning();

    if (updated.length > 0) {
      const current = updated[0].usedCount;
      return {
        success: true,
        used: current,
        remaining: Math.max(0, totalLimit - current),
      };
    } else {
      // Limit already reached or exceeded
      const existing = await db
        .select()
        .from(userQuotas)
        .where(eq(userQuotas.identifier, identifier))
        .limit(1);

      const used = existing[0]?.usedCount ?? totalLimit;
      return {
        success: false,
        used,
        remaining: 0,
      };
    }
  } catch (error) {
    console.error('Failed to consume quota in DB:', error);
    throw new Error('Database update failed. Please try again later.', { cause: error });
  }
}
