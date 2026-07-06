import { randomBytes, createHash } from "crypto";
import { Resend } from "resend";
import { defaultLocale, normalizeLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";

const RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function te(locale: Locale, key: Parameters<typeof translate>[1], values?: Record<string, string | number>) {
  return translate(locale, key, values);
}

export function createPasswordResetToken() {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetLink(params: {
  email: string;
  name: string;
  token: string;
  locale?: Locale;
}) {
  const locale = normalizeLocale(params.locale ?? defaultLocale);
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    throw new Error("APP_URL is not configured");
  }

  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(params.token)}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const logLink = process.env.EMAIL_VERIFICATION_LOG_LINK === "true";

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production" || logLink) {
      console.info(`[EMAIL] Password reset link for ${params.email}: ${resetUrl}`);
      return;
    }

    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL are required in production");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.email,
    subject: te(locale, "resetEmail.subject"),
    html: buildResetEmailHtml({
      name: params.name,
      resetUrl,
      locale,
    }),
    text: [
      te(locale, "resetEmail.greeting", { name: params.name }),
      "",
      te(locale, "resetEmail.intro"),
      resetUrl,
      "",
      `${te(locale, "resetEmail.expiry")} ${te(locale, "resetEmail.ignore")}`,
      "",
      te(locale, "resetEmail.signature"),
    ].join("\n"),
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function buildResetEmailHtml(params: {
  name: string;
  resetUrl: string;
  locale: Locale;
}) {
  const safeName = escapeHtml(params.name);
  const safeUrl = escapeHtml(params.resetUrl);
  const locale = params.locale;

  return `
    <!doctype html>
    <html lang="${locale}">
      <body style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #eef2f7;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4f46e5;">SuperHRD</div>
              <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#0f172a;">${escapeHtml(te(locale, "resetEmail.heading"))}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(te(locale, "resetEmail.greeting", { name: safeName }))}</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(te(locale, "resetEmail.body"))}</p>
              <a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:8px;">${escapeHtml(te(locale, "resetEmail.button"))}</a>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(te(locale, "resetEmail.expiry"))}</p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#475569;"><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef2f7;font-size:12px;line-height:1.6;color:#64748b;">
              ${escapeHtml(te(locale, "resetEmail.footer"))}
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
