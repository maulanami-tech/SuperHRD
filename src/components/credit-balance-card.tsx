import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
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
    <div className="overflow-hidden rounded-lg bg-gradient-to-br from-indigo-500 via-primary to-violet-600 p-6 text-primary-foreground shadow-lg shadow-primary/20">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Coins className="h-4 w-4" />
            Your Credit Balance
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-semibold tracking-tight">
              {balance}
            </span>
            <span className="pb-2 text-sm text-white/75">paid credits</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/75">
            <span>{balance} paid screenings remaining</span>
            <span>Free quota: {dailyQuotaRemaining}/5 today</span>
            {typeof totalPurchased === "number" && (
              <span>Total purchased: {totalPurchased}</span>
            )}
          </div>
        </div>
        <Button asChild className="bg-white text-primary hover:bg-white/90">
          <Link href="/topup">
            Top Up Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
