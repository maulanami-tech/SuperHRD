import { NextRequest, NextResponse } from "next/server";
import { approveTopup } from "@/lib/credits";
import {
  parseMidtransNotification,
  verifyMidtransSignature,
  type MidtransNotification,
} from "@/lib/midtrans";
import { prisma } from "@/lib/prisma";

function isSuccessfulPayment(notification: MidtransNotification): boolean {
  if (notification.transaction_status === "settlement") {
    return true;
  }

  return (
    notification.transaction_status === "capture" &&
    (!notification.fraud_status || notification.fraud_status === "accept")
  );
}

function isExpiredPayment(notification: MidtransNotification): boolean {
  return notification.transaction_status === "expire";
}

function isRejectedPayment(notification: MidtransNotification): boolean {
  return ["cancel", "deny", "failure"].includes(
    notification.transaction_status ?? "",
  );
}

async function updateProviderState(notification: MidtransNotification) {
  if (!notification.order_id) {
    return null;
  }

  const topup = await prisma.topupRequest.findUnique({
    where: { providerOrderId: notification.order_id },
    select: { id: true },
  });

  if (!topup) {
    return null;
  }

  return prisma.topupRequest.update({
    where: { id: topup.id },
    data: {
      providerTransactionId: notification.transaction_id ?? null,
      providerStatus: notification.transaction_status ?? null,
      providerFraudStatus: notification.fraud_status ?? null,
      providerPayload: JSON.stringify(notification),
    },
    select: {
      id: true,
      status: true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MidtransNotification;

    if (!verifyMidtransSignature(body)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const notification = await parseMidtransNotification(body);
    const topup = await updateProviderState(notification);

    if (!topup) {
      return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
    }

    if (isSuccessfulPayment(notification)) {
      const result = await approveTopup(topup.id, "midtrans");
      return NextResponse.json({
        success: true,
        status: "approved",
        creditAmount: result.creditAmount,
        newBalance: result.newBalance,
      });
    }

    if (isExpiredPayment(notification)) {
      await prisma.topupRequest.updateMany({
        where: { id: topup.id, status: "pending" },
        data: {
          status: "expired",
          processedAt: new Date(),
          processedBy: "midtrans",
          notes: "Midtrans payment expired",
        },
      });
      return NextResponse.json({ success: true, status: "expired" });
    }

    if (isRejectedPayment(notification)) {
      await prisma.topupRequest.updateMany({
        where: { id: topup.id, status: "pending" },
        data: {
          status: "rejected",
          processedAt: new Date(),
          processedBy: "midtrans",
          notes: `Midtrans payment ${notification.transaction_status}`,
        },
      });
      return NextResponse.json({ success: true, status: "rejected" });
    }

    return NextResponse.json({
      success: true,
      status: notification.transaction_status ?? "pending",
    });
  } catch (error) {
    console.error("Midtrans notification error:", error);
    return NextResponse.json(
      { error: "Failed to process Midtrans notification" },
      { status: 500 },
    );
  }
}
