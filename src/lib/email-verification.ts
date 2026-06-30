import { randomBytes, createHash } from "crypto";
import { Resend } from "resend";

const VERIFICATION_TOKEN_BYTES = 32;
export const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;

export function createEmailVerificationToken() {
  const token = randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendEmailVerificationLink(params: {
  email: string;
  name: string;
  token: string;
}) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    throw new Error("APP_URL is not configured");
  }

  const verificationUrl = `${appUrl}/api/verify-email?token=${encodeURIComponent(params.token)}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const logLink = process.env.EMAIL_VERIFICATION_LOG_LINK === "true";

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production" || logLink) {
      console.info(`[EMAIL] Verification link for ${params.email}: ${verificationUrl}`);
      return;
    }

    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL are required in production");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.email,
    subject: "Verify your SuperHRD account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="font-size: 20px;">Verify your SuperHRD account</h1>
        <p>Hi ${escapeHtml(params.name)},</p>
        <p>Click the button below to verify your email address. This link expires in 30 minutes.</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none;">
            Verify email
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      </div>
    `,
    text: [
      `Hi ${params.name},`,
      "",
      "Verify your SuperHRD account by opening this link:",
      verificationUrl,
      "",
      "This link expires in 30 minutes.",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
