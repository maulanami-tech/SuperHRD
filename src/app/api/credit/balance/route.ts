import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserBalance } from '@/lib/credits';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const balance = await getUserBalance(session.user.id);
    return NextResponse.json(balance);
  } catch (error) {
    console.error('Failed to get balance:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve balance' },
      { status: 500 }
    );
  }
}
