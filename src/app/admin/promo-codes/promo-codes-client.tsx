"use client";

import { Fragment, useState } from "react";
import { Loader2, TicketPercent, History } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { formatDateTime } from "@/lib/i18n/format";

type PromoType = "registration" | "topup" | "any";

interface PromoCodeRow {
  id: string;
  code: string;
  type: PromoType;
  creditAmount: number;
  bonusPercent: number | null;
  discountPercent: number | null;
  maxRedemptions: number | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  claimedCount: number;
  pendingCount: number;
  redemptions?: RedemptionRow[];
}

interface RedemptionRow {
  id: string;
  status: "pending" | "claimed";
  context: string;
  creditAmount: number;
  createdAt: string;
  claimedAt: string | null;
  user?: { id: string; name: string; email: string };
}

const TYPE_LABELS: Record<PromoType, string> = {
  registration: "Registration",
  topup: "Top-up",
  any: "Any",
};

const TYPE_BADGE_VARIANTS: Record<PromoType, "default" | "secondary" | "outline"> = {
  registration: "default",
  topup: "outline",
  any: "secondary",
};

export function PromoCodesClient({ initialCodes }: { initialCodes: PromoCodeRow[] }) {
  const { locale, t } = useI18n();
  const [codes, setCodes] = useState<PromoCodeRow[]>(initialCodes);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PromoType | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "registration" as PromoType,
    creditAmount: "",
    bonusPercent: "",
    discountPercent: "",
    maxRedemptions: "",
    expiresAt: "",
  });

  async function loadCodes(filter?: PromoType | "") {
    try {
      const params = new URLSearchParams();
      if (filter) params.set("type", filter);
      const res = await fetch(`/api/admin/promo-codes?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCodes(data.codes);
    } catch {
      toast.error(t("adminPromo.loadFailed"));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const creditAmount = parseInt(form.creditAmount || "0", 10);
    const bonusPercent = form.bonusPercent ? parseInt(form.bonusPercent, 10) : null;

    if (!form.code.trim()) {
      toast.error(t("adminPromo.createFailed"));
      return;
    }
    if (creditAmount < 1 && !bonusPercent) {
      toast.error(t("validation.promoBonusRequired"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          type: form.type,
          creditAmount: creditAmount || 0,
          bonusPercent: bonusPercent || null,
          discountPercent: form.discountPercent ? parseInt(form.discountPercent, 10) : null,
          maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions, 10) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });

      if (res.status === 409) {
        toast.error(t("validation.promoCodeExists"));
        return;
      }
      if (!res.ok) throw new Error();

      toast.success(t("adminPromo.created"));
      setForm({ code: "", type: "registration", creditAmount: "", bonusPercent: "", discountPercent: "", maxRedemptions: "", expiresAt: "" });
      await loadCodes(typeFilter);
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
      await loadCodes(typeFilter);
    } catch {
      toast.error(t("adminPromo.updateFailed"));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleFilterChange(filter: PromoType | "") {
    setTypeFilter(filter);
    await loadCodes(filter);
  }

  async function handleExpandRedemptions(row: PromoCodeRow) {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setLoadingRedemptions(true);
    try {
      const params = new URLSearchParams({ redemptions: "1" });
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/admin/promo-codes?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCodes(data.codes);
      setExpandedId(row.id);
    } catch {
      toast.error(t("adminPromo.loadFailed"));
    } finally {
      setLoadingRedemptions(false);
    }
  }

  const filteredCodes = codes;

  return (
    <div className="flex flex-col">
      <Header title={t("adminPromo.title")} description={t("adminPromo.description")} />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6">
        {/* Create Form */}
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
              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="promo-code">{t("adminPromo.codeLabel")}</Label>
                <Input
                  id="promo-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="SAVE20TOPUP"
                  className="uppercase placeholder:normal-case"
                  maxLength={32}
                  required
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="promo-type">{t("adminPromo.typeLabel")}</Label>
                <select
                  id="promo-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PromoType })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="registration">{t("adminPromo.typeRegistration")}</option>
                  <option value="topup">{t("adminPromo.typeTopup")}</option>
                  <option value="any">{t("adminPromo.typeAny")}</option>
                </select>
              </div>

              {/* Flat bonus credits */}
              <div className="space-y-2">
                <Label htmlFor="promo-credits">{t("adminPromo.creditAmount")}</Label>
                <Input
                  id="promo-credits"
                  type="number"
                  min={0}
                  max={100000}
                  value={form.creditAmount}
                  onChange={(e) => setForm({ ...form, creditAmount: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">{t("adminPromo.creditAmountHint")}</p>
              </div>

              {/* Bonus percent (topup only) */}
              {(form.type === "topup" || form.type === "any") && (
                <div className="space-y-2">
                  <Label htmlFor="promo-bonus-pct">{t("adminPromo.bonusPercent")}</Label>
                  <Input
                    id="promo-bonus-pct"
                    type="number"
                    min={1}
                    max={100}
                    value={form.bonusPercent}
                    onChange={(e) => setForm({ ...form, bonusPercent: e.target.value })}
                    placeholder="20"
                  />
                  <p className="text-xs text-muted-foreground">{t("adminPromo.bonusPercentHint")}</p>
                </div>
              )}

              {/* Max redemptions */}
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

              {/* Expires at */}
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

        {/* Promo Codes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>{t("adminPromo.title")}</CardTitle>
              {/* Type filter */}
              <div className="flex gap-2">
                {(["", "registration", "topup", "any"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => void handleFilterChange(f)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      typeFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f === "" ? "All" : TYPE_LABELS[f as PromoType]}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("adminPromo.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">{t("adminPromo.codeLabel")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.typeLabel")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.creditAmount")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.claimed")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.pendingClaims")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.expiresAt")}</th>
                      <th className="py-2 pr-4">{t("adminPromo.status")}</th>
                      <th className="py-2">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCodes.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b last:border-0">
                          <td className="py-3 pr-4 font-mono font-semibold">{row.code}</td>
                          <td className="py-3 pr-4">
                            <Badge variant={TYPE_BADGE_VARIANTS[row.type]}>
                              {TYPE_LABELS[row.type]}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {row.bonusPercent
                              ? `+${row.bonusPercent}%`
                              : row.creditAmount > 0
                              ? `+${row.creditAmount}`
                              : "—"}
                          </td>
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
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingId === row.id}
                                onClick={() => void handleToggle(row)}
                              >
                                {updatingId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : row.active ? (
                                  t("adminPromo.deactivate")
                                ) : (
                                  t("adminPromo.activate")
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={loadingRedemptions}
                                onClick={() => void handleExpandRedemptions(row)}
                                title={t("adminPromo.redemptionsTitle")}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Redemption history inline */}
                        {expandedId === row.id && (
                          <tr className="bg-muted/30">
                            <td colSpan={8} className="px-4 py-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("adminPromo.redemptionsTitle")} — {row.code}
                              </p>
                              {!row.redemptions || row.redemptions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t("adminPromo.redemptionsEmpty")}</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th className="pr-4 pb-1">{t("adminPromo.redemptionUser")}</th>
                                      <th className="pr-4 pb-1">{t("adminPromo.redemptionContext")}</th>
                                      <th className="pr-4 pb-1">{t("adminPromo.redemptionBonus")}</th>
                                      <th className="pr-4 pb-1">{t("adminPromo.redemptionStatus")}</th>
                                      <th className="pb-1">{t("adminPromo.redemptionDate")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.redemptions.map((r) => (
                                      <tr key={r.id} className="border-t border-muted">
                                        <td className="pr-4 py-1.5">
                                          {r.user ? (
                                            <span>
                                              {r.user.name}{" "}
                                              <span className="text-muted-foreground">({r.user.email})</span>
                                            </span>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                        <td className="pr-4 py-1.5">
                                          {r.context === "topup"
                                            ? t("adminPromo.redemptionContextTopup")
                                            : t("adminPromo.redemptionContextRegistration")}
                                        </td>
                                        <td className="pr-4 py-1.5">+{r.creditAmount}</td>
                                        <td className="pr-4 py-1.5">
                                          <Badge
                                            variant={r.status === "claimed" ? "default" : "secondary"}
                                            className="text-xs"
                                          >
                                            {r.status}
                                          </Badge>
                                        </td>
                                        <td className="py-1.5">
                                          {r.claimedAt
                                            ? formatDateTime(r.claimedAt, locale)
                                            : formatDateTime(r.createdAt, locale)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
