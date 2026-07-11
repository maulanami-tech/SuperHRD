"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChangePasswordSchema, type ChangePasswordInput } from "@/lib/validations";
import { changePassword } from "@/lib/actions";
import { useI18n } from "@/components/i18n-provider";

export default function SettingsPage() {
  const { locale, t } = useI18n();

  return (
    <>
      <Header
        title={t("settings.title")}
        description={t("settings.description")}
        breadcrumb={[
          { label: t("common.dashboard"), href: "/dashboard" },
          { label: t("settings.title") },
        ]}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="min-w-0 gap-0 rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base text-slate-950">
                    {t("settings.changePasswordTitle")}
                  </CardTitle>
                  <CardDescription className="mt-1 leading-6">
                    {t("settings.changePasswordDescription")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ChangePasswordForm locale={locale} />
            </CardContent>
          </Card>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  {t("settings.securityTipsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <p>{t("settings.securityTip1")}</p>
                <p>{t("settings.securityTip2")}</p>
                <p>{t("settings.securityTip3")}</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </>
  );
}

function ChangePasswordForm({ locale }: { locale: ReturnType<typeof useI18n>["locale"] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const schema = useMemo(() => createChangePasswordSchema(locale), [locale]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(data: ChangePasswordInput) {
    setLoading(true);
    try {
      const result = await changePassword(data, locale);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t("auth.passwordChanged"));
        router.push("/login");
      }
    } catch {
      toast.error(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    {
      id: "currentPassword" as const,
      label: t("auth.currentPassword"),
      placeholder: t("auth.enterPassword"),
      autoComplete: "current-password",
      showKey: "current" as const,
    },
    {
      id: "newPassword" as const,
      label: t("auth.newPassword"),
      placeholder: t("auth.passwordPlaceholder"),
      autoComplete: "new-password",
      showKey: "next" as const,
    },
    {
      id: "confirmPassword" as const,
      label: t("auth.confirmPassword"),
      placeholder: t("auth.confirmPasswordPlaceholder"),
      autoComplete: "new-password",
      showKey: "confirm" as const,
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <div className="relative">
            <Input
              id={field.id}
              type={show[field.showKey] ? "text" : "password"}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              {...register(field.id)}
            />
            <button
              type="button"
              onClick={() =>
                setShow((prev) => ({ ...prev, [field.showKey]: !prev[field.showKey] }))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
            >
              {show[field.showKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors[field.id] && (
            <p className="text-sm text-destructive">{errors[field.id]?.message}</p>
          )}
        </div>
      ))}
      <Button
        type="submit"
        className="bg-blue-700 text-white hover:bg-blue-800"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("auth.changingPassword")}
          </>
        ) : (
          t("auth.changePassword")
        )}
      </Button>
    </form>
  );
}
