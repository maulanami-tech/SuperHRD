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
  const status = searchParams.get('status') || 'all';

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
      whereClause.status = status as any;
    }

    const requests = await prisma.topupRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    const pendingCount = await prisma.topupRequest.count({
      where: { status: 'pending' },
    });

    return NextResponse.json({
      requests,
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
