"use server";

import { signIn, signOut } from "@/lib/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createRegisterSchema, type RegisterInput } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/ip-utils";
import {
  createEmailVerificationToken,
  sendEmailVerificationLink,
} from "@/lib/email-verification";
import { defaultLocale, normalizeLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";

function t(locale: Locale, key: Parameters<typeof translate>[1]) {
  return translate(locale, key);
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function loginUser(email: string, password: string) {
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid credentials" };
    }
    throw error;
  }
}

export async function registerUser(data: RegisterInput, requestedLocale: Locale = defaultLocale) {
  const locale = normalizeLocale(requestedLocale);
  const parsed = createRegisterSchema(locale).safeParse(data);
  if (!parsed.success) {
    return { error: t(locale, "validation.invalidData") };
  }

  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const rateLimitKey = `register:ip:${ip}`;
  const rateLimitCheck = await checkRateLimit(rateLimitKey, {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
  });

  if (!rateLimitCheck.allowed) {
    return { error: t(locale, "validation.tooManyRegistration") };
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { error: t(locale, "validation.emailRegistered") };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verification = createEmailVerificationToken();
  let createdUserId: string | null = null;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email: normalizedEmail, passwordHash },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: verification.tokenHash,
          expiresAt: verification.expiresAt,
        },
      });

      return created;
    });

    createdUserId = user.id;

    await sendEmailVerificationLink({
      email: normalizedEmail,
      name,
      token: verification.token,
      locale,
    });

    return { success: true, pendingVerification: true };
  } catch (error) {
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch((deleteError) => {
        console.error("[AUTH] Failed to clean up unverified user after email error", deleteError);
      });
    }

    console.error("[AUTH] Registration email verification failed", error);
    return { error: t(locale, "validation.sendVerificationFailed") };
  }
}

export async function resendVerificationEmail(email: string, requestedLocale: Locale = defaultLocale) {
  const locale = normalizeLocale(requestedLocale);
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: t(locale, "validation.validEmail") };
  }

  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const [emailCheck, ipCheck] = await Promise.all([
    checkRateLimit(`verify-email:resend:email:${normalizedEmail}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
    }),
    checkRateLimit(`verify-email:resend:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    }),
  ]);

  if (!emailCheck.allowed || !ipCheck.allowed) {
    return { error: t(locale, "validation.tooManyVerification") };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, emailVerified: true },
  });

  if (!user) {
    return { success: true };
  }

  if (user.emailVerified) {
    return { error: t(locale, "validation.emailAlreadyVerified") };
  }

  const verification = createEmailVerificationToken();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verification.tokenHash,
          expiresAt: verification.expiresAt,
        },
      });
    });

    await sendEmailVerificationLink({
      email: user.email,
      name: user.name,
      token: verification.token,
      locale,
    });

    return { success: true };
  } catch (error) {
    console.error("[AUTH] Resend verification email failed", error);
    return { error: t(locale, "validation.sendVerificationFailed") };
  }
}