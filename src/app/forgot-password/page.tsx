"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { createForgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/actions";
import { useI18n } from "@/components/i18n-provider";

export default function ForgotPasswordPage() {
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const schema = useMemo(() => createForgotPasswordSchema(locale), [locale]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setLoading(true);
    try {
      const result = await requestPasswordReset(data.email, locale);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setSent(true);
      }
    } catch {
      toast.error(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.forgotPasswordTitle")}
      description={t("auth.forgotPasswordDescription")}
      footer={
        <p className="mt-5 text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            {t("auth.backToSignIn")}
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <MailCheck className="h-8 w-8 text-emerald-600" />
          <p className="text-sm text-emerald-800">{t("auth.resetLinkSentHelp")}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="hrd@superhrd.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-violet-600 transition-all hover:from-primary/90 hover:to-violet-600/90 hover:shadow-lg hover:shadow-primary/25"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("auth.sending")}
              </>
            ) : (
              t("auth.sendResetLink")
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
