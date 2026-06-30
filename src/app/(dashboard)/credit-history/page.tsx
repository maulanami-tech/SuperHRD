"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CreditCard,
  History,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  creditDelta: number;
  balanceAfter: number;
  amountIdr: number | null;
  description: string;
  createdAt: string;
}

const filters = [
  { label: "All", value: "all" },
  { label: "Top Up", value: "topup_qris" },
  { label: "Screening", value: "deduct_screening" },
  { label: "AI Generate", value: "generate_prompt" },
  { label: "Quota", value: "daily_quota" },
];

const typeClasses: Record<string, string> = {
  topup_qris: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  topup_stripe: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  deduct_screening: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  generate_prompt: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  daily_quota: "bg-slate-100 text-slate-700 ring-1 ring-slate-500/20",
  refund: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  admin_adjustment: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20",
};

function formatIdr(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatType(type: string) {
  const labels: Record<string, string> = {
    topup_qris: "Top up",
    topup_stripe: "Top up",
    deduct_screening: "Screening deduction",
    generate_prompt: "AI criteria generation",
    daily_quota: "Daily quota",
    refund: "Refund",
    admin_adjustment: "Admin adjustment",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

function getTransactionIcon(tx: Transaction) {
  if (tx.creditDelta > 0) return ArrowUpRight;
  if (tx.type === "generate_prompt") return Bot;
  if (tx.creditDelta < 0) return ArrowDownLeft;
  return ReceiptText;
}

function EmptyLedger() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <History className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-950">No transactions found</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Credit purchases, AI generation, daily quota usage, and screening deductions will appear here.
      </p>
      <Button asChild className="mt-4 bg-blue-700 text-white hover:bg-blue-800">
        <Link href="/topup">Top Up Credits</Link>
      </Button>
    </div>
  );
}

export default function CreditHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);
      try {
        const res = await fetch(`/api/credit/transactions?type=${filter}&limit=50`);
        if (!res.ok) throw new Error("Failed to load transactions");
        const data: { transactions?: Transaction[] } = await res.json();
        setTransactions(data.transactions || []);
      } catch {
        toast.error("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    }
    void fetchTransactions();
  }, [filter]);

  const summary = useMemo(() => {
    const creditsIn = transactions
      .filter((tx) => tx.creditDelta > 0)
      .reduce((sum, tx) => sum + tx.creditDelta, 0);
    const creditsOut = transactions
      .filter((tx) => tx.creditDelta < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.creditDelta), 0);
    const paidSpend = transactions
      .filter((tx) => tx.amountIdr)
      .reduce((sum, tx) => sum + (tx.amountIdr ?? 0), 0);

    return {
      latestBalance: transactions[0]?.balanceAfter ?? null,
      creditsIn,
      creditsOut,
      paidSpend,
      count: transactions.length,
    };
  }, [transactions]);

  return (
    <>
      <Header
        title="Credit ledger"
        description="Audit every credit movement in your workspace"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Credit History" },
        ]}
      >
        <Button asChild size="sm" className="bg-blue-700 text-white hover:bg-blue-800">
          <Link href="/topup">
            <CreditCard className="mr-2 h-4 w-4" />
            Top Up
          </Link>
        </Button>
      </Header>

      <main className="min-w-0 flex-1 space-y-5 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        <section className="overflow-hidden rounded-lg border border-blue-100 bg-gradient-to-br from-white via-blue-50/80 to-emerald-50/70 shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="p-5 sm:p-6 lg:p-7">
              <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-800 shadow-sm">
                <ReceiptText className="h-4 w-4" />
                Credit ledger
              </div>
              <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Track purchases, quota usage, and screening deductions in one ledger.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Use the filters to inspect how credits move across top-ups, AI prompt generation, and CV screening activity.
              </p>
            </div>

            <div className="border-t border-blue-100 bg-white/75 p-5 lg:border-l lg:border-t-0 lg:p-6">
              <p className="text-sm font-semibold text-slate-950">Current view</p>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Transactions</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{summary.count}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Latest balance</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{summary.latestBalance ?? "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Credits in</p>
                  <p className="mt-4 text-2xl font-semibold text-emerald-700">+{summary.creditsIn}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Positive changes</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Credits used</p>
                  <p className="mt-4 text-2xl font-semibold text-red-700">-{summary.creditsOut}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-red-600/15">
                  <ArrowDownLeft className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Usage deductions</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Paid amount</p>
                  <p className="mt-4 text-2xl font-semibold text-slate-950">{summary.paidSpend ? formatIdr(summary.paidSpend) : "-"}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-600/15">
                  <Wallet className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Recorded payment</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Filter</p>
                  <p className="mt-4 text-2xl font-semibold text-blue-700">{filters.find((item) => item.value === filter)?.label ?? "All"}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-600/15">
                  <CalendarDays className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Latest 50 records</p>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Transaction ledger</CardTitle>
                <CardDescription>Filter by transaction type to audit balance changes.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map((item) => (
                  <Button
                    key={item.value}
                    variant={filter === item.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(item.value)}
                    className={cn(
                      "h-9 transition-colors",
                      filter === item.value
                        ? "bg-blue-700 text-white hover:bg-blue-800"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-56" />
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <Skeleton className="ml-auto h-5 w-16" />
                        <Skeleton className="ml-auto h-3 w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyLedger />
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const TxIcon = getTransactionIcon(tx);
                  const isPositive = tx.creditDelta > 0;
                  const isNegative = tx.creditDelta < 0;
                  return (
                    <div
                      key={tx.id}
                      className="grid gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1",
                            isPositive && "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
                            isNegative && "bg-red-50 text-red-700 ring-red-600/15",
                            !isPositive && !isNegative && "bg-slate-100 text-slate-600 ring-slate-500/15"
                          )}
                        >
                          <TxIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={typeClasses[tx.type] || "bg-slate-100 text-slate-700 ring-1 ring-slate-500/20"}>
                              {formatType(tx.type)}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {new Date(tx.createdAt).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-900">{tx.description}</p>
                          {tx.amountIdr && (
                            <p className="mt-1 text-xs text-slate-500">
                              Payment amount: {formatIdr(tx.amountIdr)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end justify-between border-t border-slate-100 pt-3 lg:block lg:border-t-0 lg:pt-0 lg:text-right">
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            isPositive && "text-emerald-700",
                            isNegative && "text-red-700",
                            !isPositive && !isNegative && "text-slate-500"
                          )}
                        >
                          {tx.creditDelta > 0 && "+"}
                          {tx.creditDelta}
                        </p>
                        <p className="text-xs text-slate-500">Balance: {tx.balanceAfter}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}