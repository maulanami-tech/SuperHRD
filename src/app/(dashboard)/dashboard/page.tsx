"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Clock3, Search, Upload, Users } from "lucide-react";
import { useCandidates } from "@/hooks/use-candidates";
import { CandidatesTable } from "@/components/candidates-table";
import { Header } from "@/components/header";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { CreditBalanceCard } from "@/components/credit-balance-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreditBalance {
  creditBalance: number;
  dailyQuotaRemaining: number;
  totalPurchased: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch("/api/credit/balance");
        if (!res.ok) return;
        const data: CreditBalance = await res.json();
        setBalance(data);
      } catch (error) {
        console.error("Failed to load balance:", error);
      }
    }
    void fetchBalance();
  }, []);

  const { candidates, isLoading, error, refetch } = useCandidates({
    search: debouncedSearch,
    status: status === "all" ? "" : status,
  });

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayCount = candidates.filter(
      (candidate) => new Date(candidate.createdAt).toDateString() === today
    ).length;
    const completed = candidates.filter(
      (candidate) => candidate.status === "completed"
    );
    const averageScore =
      completed.length > 0
        ? Math.round(
            completed.reduce(
              (sum, candidate) => sum + (candidate.overallScore ?? 0),
              0
            ) / completed.length
          )
        : "-";

    return {
      todayCount,
      total: candidates.length,
      completed: completed.length,
      averageScore,
    };
  }, [candidates]);

  const handleDeleted = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <>
      <Header title="Dashboard" description="Track credits and screening activity">
        <Button asChild size="sm">
          <Link href="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload CV
          </Link>
        </Button>
      </Header>

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {balance && (
          <CreditBalanceCard
            balance={balance.creditBalance}
            dailyQuotaRemaining={balance.dailyQuotaRemaining}
            totalPurchased={balance.totalPurchased}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's Screening" value={stats.todayCount} icon={Clock3} />
          <StatCard label="Total Candidates" value={stats.total} icon={Users} />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} />
          <StatCard label="Average Score" value={stats.averageScore} icon={BarChart3} />
        </div>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Recent Candidates</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} />
            ) : error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : candidates.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <CandidatesTable candidates={candidates} onDeleted={handleDeleted} />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
