import { NextRequest, NextResponse } from "next/server";
import {
  parseMidtransNotification,
  verifyMidtransSignature,
  type MidtransNotification,
} from "@/lib/midtrans";
import { processMidtransTopupStatus } from "@/lib/midtrans-topup";
import { checkRateLimit } from "@/lib/rate-limit";

const NOTIFICATION_RATE_LIMIT_MAX = 10;
const NOTIFICATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function canProcessSignedBodyDirectly(body: MidtransNotification): boolean {
  return Boolean(body.order_id && body.transaction_status && body.gross_amount && body.status_code);
}

function getMidtransErrorSummary(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const midtransError = error as {
    message?: string;
    ApiResponse?: { status_code?: string; status_message?: string; id?: string };
    httpStatusCode?: string | number;
  };

  return {
    message: midtransError.message,
    httpStatusCode: midtransError.httpStatusCode,
    statusCode: midtransError.ApiResponse?.status_code,
    statusMessage: midtransError.ApiResponse?.status_message,
    responseId: midtransError.ApiResponse?.id,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MidtransNotification;

    if (!verifyMidtransSignature(body)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (body.order_id) {
      const rateLimit = await checkRateLimit(`midtrans:webhook:${body.order_id}`, {
        windowMs: NOTIFICATION_RATE_LIMIT_WINDOW_MS,
        maxRequests: NOTIFICATION_RATE_LIMIT_MAX,
      });
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many notifications for this order" },
          { status: 429 },
        );
      }
    }

    let notification: MidtransNotification;
    try {
      notification = await parseMidtransNotification(body);
    } catch (error) {
      if (!canProcessSignedBodyDirectly(body)) {
        throw error;
      }

      console.warn("Midtrans notification parse fallback to signed body:", getMidtransErrorSummary(error));
      notification = body;
    }

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
