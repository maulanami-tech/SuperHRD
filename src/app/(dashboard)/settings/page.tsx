"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
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
    <div className="flex flex-col">
      <Header title={t("settings.title")} description={t("settings.description")} />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {t("settings.changePasswordTitle")}
            </CardTitle>
            <CardDescription>{t("settings.changePasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm locale={locale} />
          </CardContent>
        </Card>
      </main>
    </div>
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
        className="bg-gradient-to-r from-primary to-violet-600 transition-all hover:from-primary/90 hover:to-violet-600/90 hover:shadow-lg hover:shadow-primary/25"
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
