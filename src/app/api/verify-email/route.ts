import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashEmailVerificationToken } from "@/lib/email-verification";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? req.url;
  const redirectUrl = new URL("/verify-email", appUrl);

  if (!token) {
    redirectUrl.searchParams.set("status", "invalid");
    return NextResponse.redirect(redirectUrl);
  }

  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= now) {
    redirectUrl.searchParams.set("status", "invalid");
    return NextResponse.redirect(redirectUrl);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const tokenUpdate = await tx.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (tokenUpdate.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: now },
    });

    await tx.emailVerificationToken.updateMany({
      where: {
        userId: verificationToken.userId,
        usedAt: null,
        id: { not: verificationToken.id },
      },
      data: { usedAt: now },
    });

    return true;
  });

  redirectUrl.searchParams.set("status", updated ? "success" : "invalid");
  return NextResponse.redirect(redirectUrl);
}
