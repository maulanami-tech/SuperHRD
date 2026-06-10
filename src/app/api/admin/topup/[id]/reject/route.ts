import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rejectTopup } from '@/lib/credits';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CUID_REGEX = /^c[^\s-]{8,}$/i;

const rejectSchema = z.object({
  notes: z.string().min(1, 'Rejection reason is required').max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Re-validate admin status from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: topupId } = await params;

  if (!CUID_REGEX.test(topupId)) {
    return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validation = rejectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await rejectTopup(topupId, session.user.id, validation.data.notes);

    return NextResponse.json({
      success: true,
      message: 'Top-up rejected',
    });
  } catch (error: unknown) {
    console.error('Failed to reject top-up:', error);
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 });
    }

    if (message.includes('Cannot reject')) {
      return NextResponse.json({ error: 'This top-up request cannot be rejected' }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to reject top-up' },
      { status: 500 }
    );
  }
}
