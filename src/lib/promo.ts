import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PromoCodeType } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Find a promo code that can still be redeemed: active, not expired,
 * correct type for the context, and (if capped) with remaining slots.
 * Pending redemptions count against the cap so the quota cannot be
 * oversubscribed between checkout and payment settlement.
 */
export async function findRedeemablePromoCode(
  code: string,
  db: Db = prisma,
  context: "registration" | "topup" = "registration"
) {
  const promo = await db.promoCode.findUnique({
    where: { code },
    select: {
      id: true,
      type: true,
      creditAmount: true,
      bonusPercent: true,
      discountPercent: true,
      maxRedemptions: true,
      expiresAt: true,
      active: true,
    },
  });

  if (!promo || !promo.active) return null;
  if (promo.expiresAt && promo.expiresAt <= new Date()) return null;

  // Enforce type-context match
  if (promo.type !== PromoCodeType.any && promo.type !== context) return null;

  if (promo.maxRedemptions !== null) {
    const used = await db.promoRedemption.count({ where: { codeId: promo.id } });
    if (used >= promo.maxRedemptions) return null;
  }

  return promo;
}

/**
 * Claim the user's pending registration promo redemption (if any).
 * Called after email verification. Idempotent via conditional update.
 */
export async function claimPromoRedemption(userId: string, tx: Prisma.TransactionClient) {
  const redemption = await tx.promoRedemption.findFirst({
    where: { userId, context: "registration", status: "pending" },
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
        context: "registration",
      }),
    },
  });

  return { creditAmount: redemption.creditAmount, code: redemption.code.code };
}

/**
 * Compute the bonus credits for a topup promo given the bundle's base credits.
 * bonusPercent takes precedence over flat creditAmount.
 */
export function computeTopupPromoBonus(
  promo: { creditAmount: number; bonusPercent: number | null },
  bundleCredits: number
): number {
  if (promo.bonusPercent && promo.bonusPercent > 0) {
    return Math.floor((bundleCredits * promo.bonusPercent) / 100);
  }
  return promo.creditAmount;
}

/**
 * Claim a pending topup promo redemption after payment succeeds.
 * Called inside the approveTopup transaction.
 */
export async function claimTopupPromoRedemption(
  userId: string,
  promoCodeId: string,
  tx: Prisma.TransactionClient
) {
  const redemption = await tx.promoRedemption.findFirst({
    where: { userId, codeId: promoCodeId, context: "topup", status: "pending" },
    select: {
      id: true,
      creditAmount: true,
      code: { select: { code: true } },
    },
  });

  if (!redemption) return null;

  const claimed = await tx.promoRedemption.updateMany({
    where: { id: redemption.id, status: "pending" },
    data: { status: "claimed", claimedAt: new Date() },
  });

  if (claimed.count !== 1) return null;

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
      description: `Promo bonus (top-up): ${redemption.code.code}`,
      metadata: JSON.stringify({
        promoCode: redemption.code.code,
        redemptionId: redemption.id,
        context: "topup",
      }),
    },
  });

  return { creditAmount: redemption.creditAmount, code: redemption.code.code };
}
