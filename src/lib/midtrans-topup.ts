import { approveTopup } from "@/lib/credits";
import { type MidtransNotification } from "@/lib/midtrans";
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

export async function processMidtransTopupStatus(notification: MidtransNotification) {
  if (!notification.order_id) {
    return { error: "Missing order_id", httpStatus: 400 as const };
  }

  const topup = await prisma.topupRequest.findUnique({
    where: { providerOrderId: notification.order_id },
    select: { id: true, status: true },
  });

  if (!topup) {
    return { error: "Top-up request not found", httpStatus: 404 as const };
  }

  await prisma.topupRequest.update({
    where: { id: topup.id },
    data: {
      providerTransactionId: notification.transaction_id ?? null,
      providerStatus: notification.transaction_status ?? null,
      providerFraudStatus: notification.fraud_status ?? null,
      providerPayload: JSON.stringify(notification),
    },
  });

  if (isSuccessfulPayment(notification)) {
    const result = await approveTopup(topup.id, "midtrans");
    return {
      success: true,
      status: "approved" as const,
      creditAmount: result.creditAmount,
      newBalance: result.newBalance,
    };
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
    return { success: true, status: "expired" as const };
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
    return { success: true, status: "rejected" as const };
  }

  return {
    success: true,
    status: notification.transaction_status ?? "pending",
  };
}
