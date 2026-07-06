"use client";

import {
  Activity,
  AlertTriangle,
  CircleCheck,
  Clock,
  MailWarning,
  TicketPercent,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { formatIdr, formatRelativeDate } from "@/lib/i18n/format";
import type { AdminOverviewStats } from "@/lib/admin-stats";
import { cn } from "@/lib/utils";

const COLORS = {
  primary: "#4f46e5",
  emerald: "#10b981",
  red: "#ef4444",
  slate: "#94a3b8",
};

const txTypeClasses: Record<string, string> = {
  topup_qris: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  topup_stripe: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  deduct_screening: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  generate_prompt: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  daily_quota: "bg-slate-100 text-slate-700 ring-1 ring-slate-500/20",
  refund: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  admin_adjustment: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20",
  promo_bonus: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-600/20",
};

function shortDay(date: string) {
  return date.slice(8) + "/" + date.slice(5, 7);
}

export function OverviewClient({ stats }: { stats: AdminOverviewStats }) {
  const { locale, t } = useI18n();
  const { kpi, daily, health, activity } = stats;

  const chartData = daily.map((d) => ({ ...d, day: shortDay(d.date) }));

  const funnelSteps = [
    { label: t("adminOverview.registered"), value: health.funnel.registered },
    { label: t("adminOverview.verifiedStep"), value: health.funnel.verified },
    { label: t("adminOverview.screenedStep"), value: health.funnel.screenedOnce },
    { label: t("adminOverview.paidStep"), value: health.funnel.paidOnce },
  ];
  const funnelMax = Math.max(1, health.funnel.registered);

  const healthItems = [
    {
      icon: AlertTriangle,
      label: t("adminOverview.failed24h"),
      value: health.failed24h,
      alert: health.failed24h > 0,
    },
    {
      icon: Clock,
      label: t("adminOverview.stuck"),
      value: health.stuckProcessing,
      alert: health.stuckProcessing > 0,
    },
    {
      icon: MailWarning,
      label: t("adminOverview.unverified"),
      value: health.unverifiedUsers,
      alert: false,
    },
  ];

  return (
    <div className="flex flex-col">
      <Header title={t("adminOverview.title")} description={t("adminOverview.description")} />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6">
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={Users}
            label={t("adminOverview.totalUsers")}
            value={String(kpi.totalUsers)}
            hint={`${t("adminOverview.newUsers7d", { count: kpi.newUsers7d })} · ${t("adminOverview.vsPrev", { count: kpi.newUsersPrev7d })}`}
          />
          <KpiCard
            icon={TrendingUp}
            label={t("adminOverview.revenue30d")}
            value={formatIdr(kpi.revenue30dIdr, locale)}
            hint={t("adminOverview.revenueToday", { amount: formatIdr(kpi.revenueTodayIdr, locale) })}
          />
          <KpiCard
            icon={Activity}
            label={t("adminOverview.screenings")}
            value={String(kpi.screeningsTotal)}
            hint={`${t("adminOverview.screeningsToday", { count: kpi.screeningsToday })} · ${t("adminOverview.failedRate", { pct: kpi.failedRatePct })}`}
          />
          <KpiCard
            icon={Wallet}
            label={t("adminOverview.pendingTopups")}
            value={String(kpi.pendingTopups)}
            hint={t("adminOverview.needsAction")}
            highlight={kpi.pendingTopups > 0}
          />
          <Link href="/admin/promo-codes" className="block">
            <KpiCard
              icon={TicketPercent}
              label={t("adminOverview.promoClaims")}
              value={String(kpi.promoClaims30d)}
              hint={t("adminOverview.promoClaimsDesc")}
            />
          </Link>
        </div>

        {/* Trend charts */}
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartCard
            title={t("adminOverview.registrationsChart")}
            subtitle={t("adminOverview.last30Days")}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  name={t("adminOverview.registrationsChart")}
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  fill="url(#regGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={t("adminOverview.revenueChart")}
            subtitle={t("adminOverview.last30Days")}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v >= 1000000 ? `${v / 1000000}jt` : v >= 1000 ? `${v / 1000}rb` : String(v))}
                />
                <Tooltip formatter={(value) => formatIdr(Number(value), locale)} />
                <Area
                  type="monotone"
                  dataKey="revenueIdr"
                  name={t("adminOverview.revenueChart")}
                  stroke={COLORS.emerald}
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={t("adminOverview.screeningsChart")}
            subtitle={t("adminOverview.last30Days")}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" name={t("statuses.completed")} stackId="s" fill={COLORS.emerald} />
                <Bar dataKey="failed" name={t("statuses.failed")} stackId="s" fill={COLORS.red} />
                <Bar
                  dataKey="other"
                  name={t("adminOverview.otherStatus")}
                  stackId="s"
                  fill={COLORS.slate}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Health + funnel */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {t("adminOverview.health")}
              </CardTitle>
              <CardDescription>{t("adminOverview.healthDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-4 py-3",
                    item.alert
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.alert ? (
                      <item.icon className="h-4 w-4 text-red-600" />
                    ) : (
                      <CircleCheck className="h-4 w-4 text-emerald-600" />
                    )}
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </div>
                  <span
                    className={cn(
                      "text-lg font-semibold",
                      item.alert ? "text-red-700" : "text-slate-900"
                    )}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("adminOverview.funnel")}</CardTitle>
              <CardDescription>{t("adminOverview.funnelDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnelSteps.map((step) => {
                const pct = Math.round((step.value / funnelMax) * 100);
                return (
                  <div key={step.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{step.label}</span>
                      <span className="font-medium text-slate-900">
                        {step.value} <span className="text-xs text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle>{t("adminOverview.activity")}</CardTitle>
            <CardDescription>{t("adminOverview.activityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("adminOverview.emptyActivity")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">{t("adminOverview.user")}</th>
                      <th className="py-2 pr-4">{t("adminOverview.type")}</th>
                      <th className="py-2 pr-4">{t("adminOverview.creditsCol")}</th>
                      <th className="py-2 pr-4">IDR</th>
                      <th className="py-2">{t("adminOverview.when")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-900">{tx.userName}</div>
                          <div className="text-xs text-slate-500">{tx.userEmail}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="outline"
                            className={cn("border-0 font-normal", txTypeClasses[tx.type])}
                          >
                            {tx.type.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "py-3 pr-4 font-medium",
                            tx.creditDelta > 0
                              ? "text-emerald-600"
                              : tx.creditDelta < 0
                                ? "text-red-600"
                                : "text-slate-500"
                          )}
                        >
                          {tx.creditDelta > 0 ? `+${tx.creditDelta}` : tx.creditDelta}
                        </td>
                        <td className="py-3 pr-4">
                          {tx.amountIdr !== null ? formatIdr(tx.amountIdr, locale) : "—"}
                        </td>
                        <td className="py-3 text-slate-500">
                          {formatRelativeDate(tx.createdAt, locale)}
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

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("h-full", highlight && "border-amber-300 bg-amber-50/50")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
