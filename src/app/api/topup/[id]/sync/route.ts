import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMidtransCoreApi, type MidtransNotification } from "@/lib/midtrans";
import { processMidtransTopupStatus } from "@/lib/midtrans-topup";
import { prisma } from "@/lib/prisma";

const CUID_REGEX = /^c[^\s-]{8,}$/i;

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
