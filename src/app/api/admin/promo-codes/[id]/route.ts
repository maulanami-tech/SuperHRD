import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const active = (body as { active?: unknown })?.active;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    const updated = await prisma.promoCode.update({
      where: { id },
      data: { active },
    });

    console.info(
      `[PROMO] Code ${updated.code} ${active ? "activated" : "deactivated"} by admin=${session.user.id}`
    );
    return NextResponse.json({ code: updated });
  } catch (error) {
    console.error("Failed to update promo code:", error);
    return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
  }
}
