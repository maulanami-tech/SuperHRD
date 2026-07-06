import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPromoCodeSchema } from "@/lib/validations";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Re-validate admin status from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: session.user.id };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const codes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        redemptions: {
          select: { status: true },
        },
      },
    });

    return NextResponse.json({
      codes: codes.map(({ redemptions, ...code }) => ({
        ...code,
        claimedCount: redemptions.filter((r) => r.status === "claimed").length,
        pendingCount: redemptions.filter((r) => r.status === "pending").length,
      })),
    });
  } catch (error) {
    console.error("Failed to list promo codes:", error);
    return NextResponse.json({ error: "Failed to list promo codes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPromoCodeSchema().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const code = parsed.data.code.toUpperCase();

  try {
    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "code_exists" }, { status: 409 });
    }

    const created = await prisma.promoCode.create({
      data: {
        code,
        creditAmount: parsed.data.creditAmount,
        maxRedemptions: parsed.data.maxRedemptions ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdBy: admin.userId,
      },
    });

    console.info(`[PROMO] Code created: ${created.code} by admin=${admin.userId}`);
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create promo code:", error);
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 });
  }
}
