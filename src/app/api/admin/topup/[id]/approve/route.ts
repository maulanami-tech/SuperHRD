import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { approveTopup } from '@/lib/credits';

const CUID_REGEX = /^c[^\s-]{8,}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: topupId } = await params;

  if (!CUID_REGEX.test(topupId)) {
    return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
  }

  try {
    const result = await approveTopup(topupId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Top-up approved successfully',
      newBalance: result.newBalance,
      creditAmount: result.creditAmount,
    });
  } catch (error: unknown) {
    console.error('Failed to approve top-up:', error);
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 });
    }

    if (message.includes('Cannot approve') || message.includes('not pending')) {
      return NextResponse.json({ error: 'This top-up request cannot be approved' }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to approve top-up' },
      { status: 500 }
    );
  }
}
