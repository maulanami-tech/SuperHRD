import Link from "next/link";
import { ArrowRight, Coins, Gauge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreditBalanceCardProps {
  balance: number;
  dailyQuotaRemaining: number;
  totalPurchased?: number;
}

export function CreditBalanceCard({
  balance,
  dailyQuotaRemaining,
  totalPurchased,
}: CreditBalanceCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <Coins className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-5 text-slate-950">
            Screening capacity
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Credits and daily quota available for screening.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Gauge className="h-3.5 w-3.5" />
            Paid credits
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">
            {balance}
          </div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Free quota
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-900">
            {dailyQuotaRemaining}/5
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total purchased
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {typeof totalPurchased === "number" ? totalPurchased : 0}
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 border-slate-300">
              <Link href="/topup">
                Top up
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
