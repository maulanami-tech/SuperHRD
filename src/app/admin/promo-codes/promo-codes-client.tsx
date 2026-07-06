"use client";

import { useState } from "react";
import { Loader2, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { formatDateTime } from "@/lib/i18n/format";

interface PromoCodeRow {
  id: string;
  code: string;
  creditAmount: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  claimedCount: number;
  pendingCount: number;
}

export function PromoCodesClient({ initialCodes }: { initialCodes: PromoCodeRow[] }) {
  const { locale, t } = useI18n();
  const [codes, setCodes] = useState<PromoCodeRow[]>(initialCodes);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    creditAmount: "",
    maxRedemptions: "",
    expiresAt: "",
  });

  async function loadCodes() {
    try {
      const res = await fetch("/api/admin/promo-codes");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCodes(data.codes);
    } catch {
      toast.error(t("adminPromo.loadFailed"));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const creditAmount = parseInt(form.creditAmount, 10);
    if (!form.code.trim() || !Number.isFinite(creditAmount) || creditAmount < 1) {
      toast.error(t("adminPromo.createFailed"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          creditAmount,
          maxRedemptions: form.maxRedemptions
            ? parseInt(form.maxRedemptions, 10)
            : null,
          expiresAt: form.expiresAt
            ? new Date(form.expiresAt).toISOString()
            : null,
        }),
      });

      if (res.status === 409) {
        toast.error(t("validation.promoCodeExists"));
        return;
      }
      if (!res.ok) throw new Error();

      toast.success(t("adminPromo.created"));
      setForm({ code: "", creditAmount: "", maxRedemptions: "", expiresAt: "" });
      await loadCodes();
    } catch {
      toast.error(t("adminPromo.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(row: PromoCodeRow) {
    setUpdatingId(row.id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      if (!res.ok) throw new Error();
      await loadCodes();
    } catch {
      toast.error(t("adminPromo.updateFailed"));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title={t("adminPromo.title")} description={t("adminPromo.description")} />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketPercent className="h-4 w-4 text-primary" />
              {t("adminPromo.createTitle")}
            </CardTitle>
            <CardDescription>{t("adminPromo.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promo-code">{t("adminPromo.codeLabel")}</Label>
                <Input
                  id="promo-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="LAUNCH2026"
                  className="uppercase placeholder:normal-case"
                  maxLength={32}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-credits">{t("adminPromo.creditAmount")}</Label>
                <Input
                  id="promo-credits"
                  type="number"
                  min={1}
                  max={100000}
                  value={form.creditAmount}
                  onChange={(e) => setForm({ ...form, creditAmount: e.target.value })}
                  placeholder="20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-max">{t("adminPromo.maxRedemptions")}</Label>
                <Input
                  id="promo-max"
                  type="number"
                  min={1}
                  value={form.maxRedemptions}
                  onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                  placeholder={t("adminPromo.maxRedemptionsPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-expiry">{t("adminPromo.expiresAt")}</Label>
                <Input
                  id="promo-expiry"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("adminPromo.creating")}
                    </>
                  ) : (
                    t("adminPromo.create")
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("adminPromo.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {codes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("adminPromo.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">{t("adminPromo.codeLabel")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.creditAmount")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.claimed")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.pendingClaims")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.expiresAt")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.status")}</th>
                      <th className="py-2">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-mono font-semibold">{row.code}</td>
                        <td className="py-3 pr-4">+{row.creditAmount}</td>
                        <td className="py-3 pr-4">
                          {row.claimedCount}
                          {row.maxRedemptions !== null
                            ? ` / ${row.maxRedemptions}`
                            : ` / ${t("adminPromo.unlimited")}`}
                        </td>
                        <td className="py-3 pr-4">{row.pendingCount}</td>
                        <td className="py-3 pr-4">
                          {row.expiresAt
                            ? formatDateTime(row.expiresAt, locale)
                            : t("adminPromo.noExpiry")}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={row.active ? "default" : "secondary"}>
                            {row.active ? t("adminPromo.active") : t("adminPromo.inactive")}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === row.id}
                            onClick={() => handleToggle(row)}
                          >
                            {updatingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : row.active ? (
                              t("adminPromo.deactivate")
                            ) : (
                              t("adminPromo.activate")
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
