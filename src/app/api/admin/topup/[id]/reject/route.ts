import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rejectTopup } from '@/lib/credits';
import { z } from 'zod';

const rejectSchema = z.object({
  notes: z.string().min(1, 'Rejection reason is required').max(500),
});

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
  } catch (error: any) {
    console.error('Failed to reject top-up:', error);
    const message = error?.message || '';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Cannot reject')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to reject top-up' },
      { status: 500 }
    );
  }
}
