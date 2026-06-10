import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
  const status = searchParams.get('status') || 'all';

  const VALID_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;

  try {
    // Expire old pending requests on-read (serverless-compatible)
    await prisma.topupRequest.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    const whereClause: Prisma.TopupRequestWhereInput = {};
    if (status !== 'all') {
      if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
      }
      whereClause.status = status as typeof VALID_STATUSES[number];
    }

    const requests = await prisma.topupRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            creditBalance: true,
          },
        },
      },
    });

    const total = await prisma.topupRequest.count({ where: whereClause });
    const pendingCount = await prisma.topupRequest.count({
      where: { status: 'pending' },
    });

    return NextResponse.json({
      requests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      pendingCount,
    });
  } catch (error) {
    console.error('Failed to get admin top-up requests:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve requests' },
      { status: 500 }
    );
  }
}
