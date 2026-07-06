import { formatDistanceToNow } from "date-fns";
import { enUS, id } from "date-fns/locale";
import type { Locale } from "@/lib/i18n/config";

const dateFnsLocales = {
  en: enUS,
  id,
} as const;

export function formatRelativeDate(value: string | Date, locale: Locale) {
  return formatDistanceToNow(new Date(value), {
    addSuffix: true,
    locale: dateFnsLocales[locale],
  });
}

export function formatDateTime(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatIdr(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

