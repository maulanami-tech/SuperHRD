import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { approveTopup } from '@/lib/credits';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: topupId } = await params;

  try {
    const result = await approveTopup(topupId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Top-up approved successfully',
      newBalance: result.newBalance,
      creditAmount: result.creditAmount,
    });
  } catch (error: any) {
    console.error('Failed to approve top-up:', error);

    if (error.message.includes('already')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to approve top-up' },
      { status: 500 }
    );
  }
}
