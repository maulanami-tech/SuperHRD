"use client";

import { useTransition } from "react";
import { Languages, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { setLocalePreference } from "@/lib/i18n/actions";
import { locales, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeLabels: Record<Locale, "common.english" | "common.indonesian"> = {
  en: "common.english",
  id: "common.indonesian",
};

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function updateLocale(nextLocale: Locale) {
    startTransition(async () => {
      await setLocalePreference(nextLocale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-slate-200 bg-white">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Languages className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{t("common.language")}</span>
          <span className="font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((item) => (
          <DropdownMenuItem
            key={item}
            onSelect={() => updateLocale(item)}
            className={item === locale ? "font-semibold" : undefined}
          >
            {t(localeLabels[item])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

