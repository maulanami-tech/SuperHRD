import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { WIB_TIMEZONE } from "@/lib/credits";

const TOPUP_TYPES = ["topup_qris", "topup_stripe"] as const;
const STUCK_THRESHOLD_MS = 30 * 60 * 1000;

export interface DailyPoint {
  date: string; // yyyy-MM-dd (WIB)
  registrations: number;
  revenueIdr: number;
  completed: number;
  failed: number;
  other: number;
}

export interface AdminOverviewStats {
  kpi: {
    totalUsers: number;
    newUsers7d: number;
    newUsersPrev7d: number;
    revenue30dIdr: number;
    revenueTodayIdr: number;
    screeningsTotal: number;
    screeningsToday: number;
    failedRatePct: number;
    pendingTopups: number;
    promoClaims30d: number;
  };
  daily: DailyPoint[];
  health: {
    failed24h: number;
    stuckProcessing: number;
    unverifiedUsers: number;
    funnel: {
      registered: number;
      verified: number;
      screenedOnce: number;
      paidOnce: number;
    };
  };
  activity: Array<{
    id: string;
    userName: string;
    userEmail: string;
    type: string;
    creditDelta: number;
    amountIdr: number | null;
    description: string;
    createdAt: string;
  }>;
}

function wibDay(date: Date): string {
  return format(toZonedTime(date, WIB_TIMEZONE), "yyyy-MM-dd");
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const now = new Date();
  const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOf7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfPrev7d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startOf24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayWib = wibDay(now);

  const [
    totalUsers,
    newUsers7d,
    newUsersPrev7d,
    unverifiedUsers,
    verifiedUsers,
    users30d,
    topupTx30d,
    screeningsTotal,
    candidates30d,
    statusCounts,
    failed24h,
    stuckProcessing,
    pendingTopups,
    promoClaims30d,
    screenedUsers,
    paidUsers,
    recentTransactions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOf7d } } }),
    prisma.user.count({
      where: { createdAt: { gte: startOfPrev7d, lt: startOf7d } },
    }),
    prisma.user.count({ where: { emailVerified: null } }),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: startOf30d } },
      select: { createdAt: true },
    }),
    prisma.transaction.findMany({
      where: {
        type: { in: [...TOPUP_TYPES] },
        createdAt: { gte: startOf30d },
      },
      select: { createdAt: true, amountIdr: true },
    }),
    prisma.candidate.count(),
    prisma.candidate.findMany({
      where: { createdAt: { gte: startOf30d } },
      select: { createdAt: true, status: true },
    }),
    prisma.candidate.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.candidate.count({
      where: { status: "failed", updatedAt: { gte: startOf24h } },
    }),
    prisma.candidate.count({
      where: {
        status: "processing",
        updatedAt: { lt: new Date(now.getTime() - STUCK_THRESHOLD_MS) },
      },
    }),
    prisma.topupRequest.count({ where: { status: "pending" } }),
    prisma.promoRedemption.count({
      where: { status: "claimed", claimedAt: { gte: startOf30d } },
    }),
    prisma.candidate.findMany({
      distinct: ["submittedById"],
      select: { submittedById: true },
    }),
    prisma.topupRequest.findMany({
      where: { status: "approved" },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  // Build the 30-day series keyed by WIB day
  const days: DailyPoint[] = [];
  const dayIndex = new Map<string, DailyPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = wibDay(d);
    const point: DailyPoint = {
      date: key,
      registrations: 0,
      revenueIdr: 0,
      completed: 0,
      failed: 0,
      other: 0,
    };
    days.push(point);
    dayIndex.set(key, point);
  }

  for (const u of users30d) {
    const point = dayIndex.get(wibDay(u.createdAt));
    if (point) point.registrations += 1;
  }

  for (const tx of topupTx30d) {
    const point = dayIndex.get(wibDay(tx.createdAt));
    if (point) point.revenueIdr += tx.amountIdr ?? 0;
  }

  for (const c of candidates30d) {
    const point = dayIndex.get(wibDay(c.createdAt));
    if (!point) continue;
    if (c.status === "completed") point.completed += 1;
    else if (c.status === "failed") point.failed += 1;
    else point.other += 1;
  }

  const failedTotal =
    statusCounts.find((s) => s.status === "failed")?._count._all ?? 0;
  const failedRatePct =
    screeningsTotal > 0 ? Math.round((failedTotal / screeningsTotal) * 100) : 0;

  const screeningsToday = candidates30d.filter(
    (c) => wibDay(c.createdAt) === todayWib
  ).length;

  const revenueTodayIdr = topupTx30d
    .filter((tx) => wibDay(tx.createdAt) === todayWib)
    .reduce((sum, tx) => sum + (tx.amountIdr ?? 0), 0);

  const revenue30dIdr = topupTx30d.reduce(
    (sum, tx) => sum + (tx.amountIdr ?? 0),
    0
  );

  return {
    kpi: {
      totalUsers,
      newUsers7d,
      newUsersPrev7d,
      revenue30dIdr,
      revenueTodayIdr,
      screeningsTotal,
      screeningsToday,
      failedRatePct,
      pendingTopups,
      promoClaims30d,
    },
    daily: days,
    health: {
      failed24h,
      stuckProcessing,
      unverifiedUsers,
      funnel: {
        registered: totalUsers,
        verified: verifiedUsers,
        screenedOnce: screenedUsers.length,
        paidOnce: paidUsers.length,
      },
    },
    activity: recentTransactions.map((tx) => ({
      id: tx.id,
      userName: tx.user.name,
      userEmail: tx.user.email,
      type: tx.type,
      creditDelta: tx.creditDelta,
      amountIdr: tx.amountIdr,
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    })),
  };
}
