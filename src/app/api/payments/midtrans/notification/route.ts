import { NextRequest, NextResponse } from "next/server";
import {
  parseMidtransNotification,
  verifyMidtransSignature,
  type MidtransNotification,
} from "@/lib/midtrans";
import { processMidtransTopupStatus } from "@/lib/midtrans-topup";
import { checkRateLimit } from "@/lib/rate-limit";

// Midtrans retries notifications by design, and processing is idempotent, so we
// cap a single order to a sane number of accepted notifications per hour. This
// bounds outbound re-confirmation calls to the Midtrans API under replay.
const NOTIFICATION_RATE_LIMIT_MAX = 10;
const NOTIFICATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MidtransNotification;

    if (!verifyMidtransSignature(body)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Rate limit per order AFTER signature verification: without a valid
    // server key an attacker cannot forge a signature, so they cannot exhaust
    // another order's quota.
    if (body.order_id) {
      const rateLimit = await checkRateLimit(
        `midtrans:webhook:${body.order_id}`,
        {
          windowMs: NOTIFICATION_RATE_LIMIT_WINDOW_MS,
          maxRequests: NOTIFICATION_RATE_LIMIT_MAX,
        },
      );
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many notifications for this order" },
          { status: 429 },
        );
      }
    }

    const notification = await parseMidtransNotification(body);
    const result = await processMidtransTopupStatus(notification);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Midtrans notification error:", error);
    return NextResponse.json(
      { error: "Failed to process Midtrans notification" },
      { status: 500 },
    );
  }
}
