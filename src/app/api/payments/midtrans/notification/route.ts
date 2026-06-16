import { NextRequest, NextResponse } from "next/server";
import {
  parseMidtransNotification,
  verifyMidtransSignature,
  type MidtransNotification,
} from "@/lib/midtrans";
import { processMidtransTopupStatus } from "@/lib/midtrans-topup";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MidtransNotification;

    if (!verifyMidtransSignature(body)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
