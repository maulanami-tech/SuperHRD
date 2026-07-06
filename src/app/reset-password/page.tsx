"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { createResetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/actions";
import { useI18n } from "@/components/i18n-provider";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tokenError, setTokenError] = useState(!token);
  const schema = useMemo(() => createResetPasswordSchema(locale), [locale]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setLoading(true);
    try {
      const result = await resetPassword(token, data, locale);
      if (result?.error) {
        if (result.error === t("auth.invalidResetToken")) {
          setTokenError(true);
        } else {
          toast.error(result.error);
        }
      } else {
        toast.success(t("auth.passwordResetSuccess"));
        router.push("/login");
      }
    } catch {
      toast.error(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.resetPasswordTitle")}
      description={t("auth.resetPasswordDescription")}
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
      {tokenError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <TriangleAlert className="h-8 w-8 text-amber-600" />
          <p className="text-sm text-amber-800">{t("auth.invalidResetToken")}</p>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            {t("auth.requestNewResetLink")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.newPassword")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.passwordPlaceholder")}
                autoComplete="new-password"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder={t("auth.confirmPasswordPlaceholder")}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
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
                {t("auth.resettingPassword")}
              </>
            ) : (
              t("auth.resetPasswordButton")
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
