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
    html: buildVerificationEmailHtml({
      name: params.name,
      verificationUrl,
    }),
    text: [
      `Hi ${params.name},`,
      "",
      "Welcome to SuperHRD. Verify your email address to activate your account:",
      verificationUrl,
      "",
      "This link expires in 30 minutes. If you did not create a SuperHRD account, you can ignore this email.",
      "",
      "SuperHRD",
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function buildVerificationEmailHtml(params: {
  name: string;
  verificationUrl: string;
}) {
  const safeName = escapeHtml(params.name);
  const safeUrl = escapeHtml(params.verificationUrl);

  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #eef2f7;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4f46e5;">SuperHRD</div>
              <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#0f172a;">Verify your email address</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hi ${safeName},</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">Welcome to SuperHRD. Confirm this email address to activate your account and start using the CV screening dashboard.</p>
              <a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:8px;">Verify email</a>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">This link expires in 30 minutes. If the button does not work, paste this URL into your browser:</p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#475569;"><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef2f7;font-size:12px;line-height:1.6;color:#64748b;">
              You are receiving this because someone created a SuperHRD account with this email address. If this was not you, no action is needed.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}