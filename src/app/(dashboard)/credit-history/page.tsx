"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
  { label: "Deduction", value: "deduct_screening" },
  { label: "Quota", value: "daily_quota" },
];

const typeClasses: Record<string, string> = {
  topup_qris: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  topup_stripe: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  deduct_screening: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  daily_quota: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  refund: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  admin_adjustment: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20",
};

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

  return (
    <>
      <Header
        title="Transaction History"
        description="View all credit transactions"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Credit History" },
        ]}
      />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.value}
              variant={filter === item.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-28 rounded-full" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <div className="space-y-2 text-right">
                      <Skeleton className="ml-auto h-6 w-16" />
                      <Skeleton className="ml-auto h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon="transactions"
                title="No transactions yet"
                description="Credit purchases, daily quota usage, and screening deductions will appear here."
                action={{ label: "Top Up Credits", href: "/topup" }}
              />
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-3 border-b pb-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={typeClasses[tx.type] || ""}>
                          {tx.type.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{tx.description}</p>
                      {tx.amountIdr && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Rp {tx.amountIdr.toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          tx.creditDelta > 0 && "text-emerald-600",
                          tx.creditDelta < 0 && "text-red-600",
                          tx.creditDelta === 0 && "text-muted-foreground"
                        )}
                      >
                        {tx.creditDelta > 0 && "+"}
                        {tx.creditDelta}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {tx.balanceAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
