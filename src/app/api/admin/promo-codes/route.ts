import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPromoCodeSchema } from "@/lib/validations";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: session.user.id };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = req.nextUrl;
  const typeFilter = searchParams.get("type");
  const includeRedemptions = searchParams.get("redemptions") === "1";

  try {
    const codes = await prisma.promoCode.findMany({
      where: typeFilter ? { type: typeFilter as "registration" | "topup" | "any" } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        redemptions: {
          select: {
            id: true,
            status: true,
            context: true,
            creditAmount: true,
            createdAt: true,
            claimedAt: true,
            user: includeRedemptions
              ? { select: { id: true, name: true, email: true } }
              : false,
          },
        },
      },
    });

    return NextResponse.json({
      codes: codes.map(({ redemptions, ...code }) => ({
        ...code,
        claimedCount: redemptions.filter((r) => r.status === "claimed").length,
        pendingCount: redemptions.filter((r) => r.status === "pending").length,
        redemptions: includeRedemptions ? redemptions : undefined,
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
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
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
        type: parsed.data.type,
        creditAmount: parsed.data.creditAmount,
        bonusPercent: parsed.data.bonusPercent ?? null,
        discountPercent: parsed.data.discountPercent ?? null,
        maxRedemptions: parsed.data.maxRedemptions ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdBy: admin.userId,
      },
    });

    console.info(`[PROMO] Code created: ${created.code} type=${created.type} by admin=${admin.userId}`);
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create promo code:", error);
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 });
  }
}
