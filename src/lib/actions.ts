"use server";

import { auth, signIn, signOut } from "@/lib/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createRegisterSchema,
  createResetPasswordSchema,
  createChangePasswordSchema,
  type RegisterInput,
  type ResetPasswordInput,
  type ChangePasswordInput,
} from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/ip-utils";
import {
  createEmailVerificationToken,
  sendEmailVerificationLink,
} from "@/lib/email-verification";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  sendPasswordResetLink,
} from "@/lib/password-reset";
import { findRedeemablePromoCode } from "@/lib/promo";
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

  const { name, email, password, promoCode } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const normalizedPromoCode = promoCode?.trim().toUpperCase() || null;

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { error: t(locale, "validation.emailRegistered") };
  }

  // Validate the promo code up front so the user gets a clear error before
  // the account is created. The authoritative check happens again inside the
  // registration transaction.
  if (normalizedPromoCode) {
    const promo = await findRedeemablePromoCode(normalizedPromoCode);
    if (!promo) {
      return { error: t(locale, "validation.invalidPromoCode") };
    }
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

      if (normalizedPromoCode) {
        const promo = await findRedeemablePromoCode(normalizedPromoCode, tx);
        // If the code became unavailable mid-registration, register without it
        // rather than failing the whole signup.
        if (promo) {
          await tx.promoRedemption.create({
            data: {
              codeId: promo.id,
              userId: created.id,
              creditAmount: promo.creditAmount,
              context: "registration",
            },
          });
        }
      }

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

export async function requestPasswordReset(email: string, requestedLocale: Locale = defaultLocale) {
  const locale = normalizeLocale(requestedLocale);
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: t(locale, "validation.validEmail") };
  }

  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const [emailCheck, ipCheck] = await Promise.all([
    checkRateLimit(`password-reset:email:${normalizedEmail}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 3,
    }),
    checkRateLimit(`password-reset:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    }),
  ]);

  if (!emailCheck.allowed || !ipCheck.allowed) {
    return { error: t(locale, "validation.tooManyResetRequests") };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, emailVerified: true },
  });

  // Anti-enumeration: unknown or unverified emails get the same success response.
  if (!user || !user.emailVerified) {
    return { success: true };
  }

  const reset = createPasswordResetToken();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: reset.tokenHash,
          expiresAt: reset.expiresAt,
        },
      });
    });

    await sendPasswordResetLink({
      email: user.email,
      name: user.name,
      token: reset.token,
      locale,
    });
  } catch (error) {
    // Anti-enumeration: still report success; the failure is only logged.
    console.error("[AUTH] Password reset email failed", error);
  }

  return { success: true };
}

export async function resetPassword(
  token: string,
  data: ResetPasswordInput,
  requestedLocale: Locale = defaultLocale
) {
  const locale = normalizeLocale(requestedLocale);
  const parsed = createResetPasswordSchema(locale).safeParse(data);
  if (!parsed.success) {
    return { error: t(locale, "validation.invalidData") };
  }

  if (!token) {
    return { error: t(locale, "auth.invalidResetToken") };
  }

  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const ipCheck = await checkRateLimit(`password-reset:submit:ip:${ip}`, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });
  if (!ipCheck.allowed) {
    return { error: t(locale, "validation.tooManyPasswordAttempts") };
  }

  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
    return { error: t(locale, "auth.invalidResetToken") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const tokenUpdate = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (tokenUpdate.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, passwordChangedAt: now },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
        data: { usedAt: now },
      });

      return true;
    });

    if (!updated) {
      return { error: t(locale, "auth.invalidResetToken") };
    }

    console.info(`[AUTH] Password reset success: userId=${resetToken.userId}`);
    return { success: true };
  } catch (error) {
    console.error("[AUTH] Password reset failed", error);
    return { error: t(locale, "validation.resetPasswordFailed") };
  }
}

export async function changePassword(data: ChangePasswordInput, requestedLocale: Locale = defaultLocale) {
  const locale = normalizeLocale(requestedLocale);
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t(locale, "validation.notAuthenticated") };
  }

  const parsed = createChangePasswordSchema(locale).safeParse(data);
  if (!parsed.success) {
    return { error: t(locale, "validation.invalidData") };
  }

  const rateCheck = await checkRateLimit(`change-password:user:${session.user.id}`, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });
  if (!rateCheck.allowed) {
    return { error: t(locale, "validation.tooManyPasswordAttempts") };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    return { error: t(locale, "validation.notAuthenticated") };
  }

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    console.warn(`[AUTH] Change password failed: wrong current password userId=${user.id}`);
    return { error: t(locale, "validation.currentPasswordWrong") };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    console.info(`[AUTH] Password changed: userId=${user.id}`);
    return { success: true };
  } catch (error) {
    console.error("[AUTH] Change password failed", error);
    return { error: t(locale, "validation.changePasswordFailed") };
  }
}