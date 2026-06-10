import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { topupRequestSchema } from '@/lib/zod-schemas/credits';
import { addDays } from 'date-fns';

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

    const { amountIdr, proofImageUrl } = validation.data;

    // Calculate credits based on bundle
    const BUNDLES = [
      { amountIdr: 10000, credits: 20 },
      { amountIdr: 50000, credits: 110 },
      { amountIdr: 150000, credits: 350 },
      { amountIdr: 500000, credits: 1250 },
    ];

    const bundle = BUNDLES.find((b) => b.amountIdr === amountIdr);
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 });
    }

    // Create top-up request
    const topupRequest = await prisma.topupRequest.create({
      data: {
        userId: session.user.id,
        amountIdr,
        creditAmount: bundle.credits,
        paymentMethod: 'qris',
        proofImageUrl: proofImageUrl || null,
        status: 'pending',
        expiresAt: addDays(new Date(), 1), // 24 hours from now
      },
    });

    return NextResponse.json({
      success: true,
      topupRequestId: topupRequest.id,
      status: 'pending',
      message: 'Top-up request submitted. You will be notified once approved.',
    });
  } catch (error) {
    console.error('Failed to create top-up request:', error);
    return NextResponse.json(
      { error: 'Failed to create top-up request' },
      { status: 500 }
    );
  }
}
