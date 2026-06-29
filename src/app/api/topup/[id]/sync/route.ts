import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createMidtransCoreApi,
  fetchMidtransPaymentLinkStatus,
  type MidtransNotification,
} from "@/lib/midtrans";
import { approveTopup } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, addRateLimitHeaders } from "@/lib/rate-limit";

const CUID_REGEX = /^c[^\s-]{8,}$/i;
const SYNC_RATE_LIMIT_MAX = 720;
const SYNC_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isMidtransTransactionNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    ApiResponse?: { status_code?: string; status_message?: string };
    rawHttpClientData?: { status?: number; data?: { status_code?: string } };
  };

  return (
    maybeError.ApiResponse?.status_code === "404" ||
    maybeError.rawHttpClientData?.data?.status_code === "404"
  );
}

function isMidtransPaymentLinkNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("order_id not found") || message.includes("not found");
}

async function expirePendingTopup(topupId: string, notes: string) {
  await prisma.topupRequest.updateMany({
    where: { id: topupId, status: "pending" },
    data: {
      status: "expired",
      processedAt: new Date(),
      processedBy: "midtrans",
      notes,
      providerStatus: "expired",
    },
  });

  return { success: true, status: "expired" as const };
}

async function getApprovedTopupSnapshot(topupId: string) {
  const topup = await prisma.topupRequest.findUnique({
    where: { id: topupId },
    select: { status: true, providerStatus: true, creditAmount: true, userId: true },
  });

  if (!topup || topup.status !== "approved") {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: topup.userId },
    select: { creditBalance: true },
  });

  return {
    success: true,
    status: "approved" as const,
    providerStatus: topup.providerStatus ?? "settlement",
    creditAmount: topup.creditAmount,
    newBalance: user?.creditBalance ?? 0,
  };
}

async function approveTopupSafely(topupId: string) {
  try {
    const result = await approveTopup(topupId, "midtrans");
    return {
      success: true,
      status: "approved" as const,
      creditAmount: result.creditAmount,
      newBalance: result.newBalance,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("approved")) {
      throw error;
    }

    const approved = await getApprovedTopupSnapshot(topupId);
    if (approved) {
      return approved;
    }

    throw error;
  }
}

async function applyPaymentLinkStatusToTopup(params: {
  topupId: string;
  orderId: string;
  currentProviderStatus: string | null;
}) {
  const paymentLinkStatus = await fetchMidtransPaymentLinkStatus(params.orderId);
  const latestPurchase = paymentLinkStatus.purchase_history?.[paymentLinkStatus.purchase_history.length - 1];
  const transactionStatus = latestPurchase?.transaction_status?.toLowerCase();

  if (latestPurchase?.transaction_id || transactionStatus) {
    await prisma.topupRequest.update({
      where: { id: params.topupId },
      data: {
        providerTransactionId: latestPurchase?.transaction_id ?? null,
        providerStatus: transactionStatus ?? params.currentProviderStatus,
        providerFraudStatus:
          transactionStatus === "capture" || transactionStatus === "settlement"
            ? "accept"
            : null,
        providerPayload: JSON.stringify(paymentLinkStatus),
      },
    });
  }

  if (transactionStatus === "settlement" || transactionStatus === "capture") {
    return approveTopupSafely(params.topupId);
  }

  if (paymentLinkStatus.usage_status?.toUpperCase() === "EXPIRED") {
    await prisma.topupRequest.updateMany({
      where: { id: params.topupId, status: "pending" },
      data: {
        status: "expired",
        processedAt: new Date(),
        processedBy: "midtrans",
        notes: "Midtrans payment link expired",
        providerStatus: "expired",
        providerPayload: JSON.stringify(paymentLinkStatus),
      },
    });

    return { success: true, status: "expired" as const };
  }

  return {
    success: true,
    status: "pending" as const,
    providerStatus: transactionStatus ?? paymentLinkStatus.usage_status?.toLowerCase() ?? params.currentProviderStatus ?? "pending",
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!CUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid request ID format" }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(`topup:sync:user:${session.user.id}`, {
    windowMs: SYNC_RATE_LIMIT_WINDOW_MS,
    maxRequests: SYNC_RATE_LIMIT_MAX,
  });
  if (!rateLimit.allowed) {
    const response = NextResponse.json({ error: "Too many sync requests" }, { status: 429 });
    addRateLimitHeaders(response.headers, rateLimit.remaining, rateLimit.resetMs);
    return response;
  }

  try {
    const topup = await prisma.topupRequest.findFirst({
      where: {
        id,
        userId: session.user.id,
        paymentProvider: "midtrans",
      },
      select: {
        id: true,
        status: true,
        providerStatus: true,
        providerOrderId: true,
        providerTransactionId: true,
        expiresAt: true,
      },
    });

    if (!topup?.providerOrderId) {
      return NextResponse.json({ error: "Top-up payment not found" }, { status: 404 });
    }

    if (topup.status !== "pending") {
      return NextResponse.json({
        success: true,
        status: topup.status,
        providerStatus: topup.providerStatus ?? topup.status,
      });
    }

    try {
      const result = await applyPaymentLinkStatusToTopup({
        topupId: topup.id,
        orderId: topup.providerOrderId,
        currentProviderStatus: topup.providerStatus,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (!isMidtransPaymentLinkNotFound(error)) {
        throw error;
      }

      if (topup.expiresAt && topup.expiresAt.getTime() <= Date.now()) {
        const result = await expirePendingTopup(
          topup.id,
          "Midtrans payment link not found after local expiry",
        );
        return NextResponse.json(result);
      }
    }

    if (topup.providerTransactionId) {
      try {
        const status = (await createMidtransCoreApi().transaction.status(
          topup.providerTransactionId,
        )) as MidtransNotification;

        if (status.transaction_status === "settlement" || status.transaction_status === "capture") {
          const updated = await prisma.topupRequest.update({
            where: { id: topup.id },
            data: {
              providerTransactionId: status.transaction_id ?? topup.providerTransactionId,
              providerStatus: status.transaction_status ?? topup.providerStatus,
              providerFraudStatus: status.fraud_status ?? null,
              providerPayload: JSON.stringify(status),
            },
          });

          const result = await approveTopupSafely(topup.id);
          return NextResponse.json({
            ...result,
            providerStatus: updated.providerStatus ?? "settlement",
          });
        }
      } catch (error) {
        if (!isMidtransTransactionNotFound(error)) {
          throw error;
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: "pending",
      providerStatus: topup.providerStatus ?? "pending",
    });
  } catch (error) {
    console.error("Failed to sync Midtrans top-up status:", error);
    return NextResponse.json({ error: "Failed to sync payment status" }, { status: 500 });
  }
}
