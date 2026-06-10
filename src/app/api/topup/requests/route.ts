import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await prisma.topupRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amountIdr: true,
        creditAmount: true,
        paymentMethod: true,
        status: true,
        proofImageUrl: true,
        notes: true,
        createdAt: true,
        processedAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Failed to get top-up requests:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve requests' },
      { status: 500 }
    );
  }
}
