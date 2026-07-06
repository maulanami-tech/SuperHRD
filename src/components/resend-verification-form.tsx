"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";

type ResendVerificationFormProps = {
  compact?: boolean;
};

export function ResendVerificationForm({ compact = false }: ResendVerificationFormProps) {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSent(false);

    try {
      const result = await resendVerificationEmail(email, locale);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      setSent(true);
      toast.success(t("auth.verificationSent"));
    } catch {
      toast.error(t("validation.sendVerificationFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div className="space-y-2">
        <Label htmlFor="verification-email">{t("common.email")}</Label>
        <Input
          id="verification-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="hrd@superhrd.com"
          autoComplete="email"
          required
        />
      </div>
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-primary to-violet-600 transition-all hover:from-primary/90 hover:to-violet-600/90 hover:shadow-lg hover:shadow-primary/25"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("auth.sending")}
          </>
        ) : (
          <>
            <MailCheck className="h-4 w-4" />
            {t("auth.sendVerificationEmail")}
          </>
        )}
      </Button>
      {sent && (
        <p className={compact ? "text-center text-xs text-slate-500" : "text-sm text-slate-500"}>
          {t("auth.resendSentHelp")}
        </p>
      )}
    </form>
  );
}