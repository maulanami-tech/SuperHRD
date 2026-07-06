import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Find a promo code that can still be redeemed: active, not expired,
 * and (if capped) with remaining redemption slots. Pending redemptions
 * count against the cap so the quota cannot be oversubscribed between
 * registration and email verification.
 */
export async function findRedeemablePromoCode(code: string, db: Db = prisma) {
  const promo = await db.promoCode.findUnique({
    where: { code },
    select: {
      id: true,
      creditAmount: true,
      maxRedemptions: true,
      expiresAt: true,
      active: true,
    },
  });

  if (!promo || !promo.active) return null;
  if (promo.expiresAt && promo.expiresAt <= new Date()) return null;

  if (promo.maxRedemptions !== null) {
    const used = await db.promoRedemption.count({ where: { codeId: promo.id } });
    if (used >= promo.maxRedemptions) return null;
  }

  return promo;
}

/**
 * Claim the user's pending promo redemption (if any): credit the bonus and
 * record it in the transaction ledger. Called after email verification.
 * Idempotent — the conditional update guarantees a redemption is claimed once.
 */
export async function claimPromoRedemption(userId: string, tx: Prisma.TransactionClient) {
  const redemption = await tx.promoRedemption.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      creditAmount: true,
      code: { select: { code: true } },
    },
  });

  if (!redemption || redemption.status !== "pending") return null;

  const claimUpdate = await tx.promoRedemption.updateMany({
    where: { id: redemption.id, status: "pending" },
    data: { status: "claimed", claimedAt: new Date() },
  });

  if (claimUpdate.count !== 1) return null;

  const user = await tx.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: redemption.creditAmount } },
    select: { creditBalance: true },
  });

  await tx.transaction.create({
    data: {
      userId,
      type: "promo_bonus",
      creditDelta: redemption.creditAmount,
      balanceAfter: user.creditBalance,
      description: `Promo bonus: ${redemption.code.code}`,
      metadata: JSON.stringify({
        promoCode: redemption.code.code,
        redemptionId: redemption.id,
      }),
    },
  });

  return { creditAmount: redemption.creditAmount, code: redemption.code.code };
}
