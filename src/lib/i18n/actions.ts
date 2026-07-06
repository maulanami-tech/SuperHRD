"use server";

import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale, type Locale } from "@/lib/i18n/config";

export async function setLocalePreference(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, normalizeLocale(locale), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

