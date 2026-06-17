import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMidtransCoreApi, type MidtransNotification } from "@/lib/midtrans";
import { processMidtransTopupStatus } from "@/lib/midtrans-topup";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, addRateLimitHeaders } from "@/lib/rate-limit";

const CUID_REGEX = /^c[^\s-]{8,}$/i;

// The UI polls every 10s while a payment is pending; 60/hour covers normal
// polling with headroom while capping bursts that could amplify outbound calls
// to the Midtrans status API.
const SYNC_RATE_LIMIT_MAX = 60;
const SYNC_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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

  // Per-user rate limit on sync requests to bound outbound Midtrans API calls.
  const rateLimit = await checkRateLimit(
    `topup:sync:user:${session.user.id}`,
    {
      windowMs: SYNC_RATE_LIMIT_WINDOW_MS,
      maxRequests: SYNC_RATE_LIMIT_MAX,
    },
  );
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Too many sync requests" },
      { status: 429 },
    );
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
        providerOrderId: true,
        providerTransactionId: true,
      },
    });

    if (!topup?.providerOrderId) {
      return NextResponse.json({ error: "Top-up payment not found" }, { status: 404 });
    }

    const lookupId = topup.providerTransactionId ?? topup.providerOrderId;
    const status = (await createMidtransCoreApi().transaction.status(
      lookupId,
    )) as MidtransNotification;

    if (!status.order_id) {
      status.order_id = topup.providerOrderId;
    }

    const result = await processMidtransTopupStatus(status);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to sync Midtrans top-up status:", error);
    return NextResponse.json(
      { error: "Failed to sync payment status" },
      { status: 500 },
    );
  }
}
