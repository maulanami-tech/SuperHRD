import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';
import { topupRequestSchema } from '@/lib/zod-schemas/credits';
import { addMinutes } from 'date-fns';
import { BUNDLES } from '@/lib/credits';
import { createMidtransOrderId, createPaymentLink } from '@/lib/midtrans';

const TOPUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getTopupRateLimitMaxRequests() {
  const configured = Number(process.env.TOPUP_RATE_LIMIT_MAX_REQUESTS);
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return process.env.NODE_ENV === 'production' ? 5 : 50;
}

function getTopupExpiryMinutes(): number {
  const configured = Number(process.env.TOPUP_EXPIRY_MINUTES);
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return 30;
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = topupRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { amountIdr } = validation.data;

    const bundle = BUNDLES.find((b) => b.amountIdr === amountIdr);
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 });
    }

    const existingPending = await prisma.topupRequest.findFirst({
      where: {
        userId: session.user.id,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });
    if (existingPending) {
      return NextResponse.json(
        { error: 'You already have a pending top-up request. Please wait for approval or let it expire.' },
        { status: 400 }
      );
    }

    const topupKey = `topup:user:${session.user.id}`;
    const topupCheck = await checkRateLimit(topupKey, {
      windowMs: TOPUP_RATE_LIMIT_WINDOW_MS,
      maxRequests: getTopupRateLimitMaxRequests(),
    });
    if (!topupCheck.allowed) {
      const response = NextResponse.json({ error: 'Too many topup requests' }, { status: 429 });
      addRateLimitHeaders(response.headers, topupCheck.remaining, topupCheck.resetMs);
      return response;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const topupRequest = await prisma.topupRequest.create({
      data: {
        userId: session.user.id,
        amountIdr,
        creditAmount: bundle.credits,
        paymentMethod: 'qris',
        paymentProvider: 'midtrans',
        status: 'pending',
        expiresAt: addMinutes(new Date(), getTopupExpiryMinutes()),
      },
    });

    const orderId = createMidtransOrderId(topupRequest.id);

    try {
      const charge = await createPaymentLink({
        orderId,
        grossAmount: amountIdr,
        customer: {
          firstName: user.name,
          email: user.email,
        },
      });

      const updatedTopup = await prisma.topupRequest.update({
        where: { id: topupRequest.id },
        data: {
          providerOrderId: orderId,
          providerTransactionId: charge.transactionId,
          providerStatus: charge.providerStatus ?? 'pending',
          qrCodeUrl: charge.qrCodeUrl,
          qrString: charge.qrString,
          providerPayload: JSON.stringify(charge.providerPayload),
        },
      });

      return NextResponse.json({
        success: true,
        topupRequestId: updatedTopup.id,
        orderId,
        status: updatedTopup.status,
        providerStatus: updatedTopup.providerStatus,
        qrCodeUrl: updatedTopup.qrCodeUrl,
        qrString: updatedTopup.qrString,
        paymentUrl: updatedTopup.qrCodeUrl,
        expiresAt: updatedTopup.expiresAt,
        message: 'Payment link created. Credits will be released after payment succeeds.',
      });
    } catch (error) {
      await prisma.topupRequest.update({
        where: { id: topupRequest.id },
        data: {
          status: 'rejected',
          notes: 'Failed to create Midtrans Payment Link',
          processedAt: new Date(),
          providerOrderId: orderId,
        },
      });

      throw error;
    }
  } catch (error) {
    console.error('Failed to create top-up request:', error);
    return NextResponse.json(
      { error: 'Failed to create top-up request' },
      { status: 500 }
    );
  }
}
