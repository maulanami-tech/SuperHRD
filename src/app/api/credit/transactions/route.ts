import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { TransactionType } from '@/generated/prisma/enums';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
  const type = searchParams.get('type');

  try {
    const whereClause: Prisma.TransactionWhereInput = { userId: session.user.id };
    if (type && type !== 'all') {
      whereClause.type = type as TransactionType;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        creditDelta: true,
        balanceAfter: true,
        amountIdr: true,
        description: true,
        createdAt: true,
      },
    });

    const total = await prisma.transaction.count({ where: whereClause });

    return NextResponse.json({
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to get transactions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve transactions' },
      { status: 500 }
    );
  }
}
