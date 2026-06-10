import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
  const status = searchParams.get('status');

  try {
    const whereClause: Prisma.TopupRequestWhereInput = { userId: session.user.id };
    if (status && status !== 'all') {
      whereClause.status = status as any;
    }

    const requests = await prisma.topupRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
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

    const total = await prisma.topupRequest.count({ where: whereClause });

    return NextResponse.json({
      requests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to get top-up requests:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve requests' },
      { status: 500 }
    );
  }
}
