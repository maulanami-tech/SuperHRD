"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { useCandidates } from "@/hooks/use-candidates";
import { CandidatesTable } from "@/components/candidates-table";
import { Header } from "@/components/header";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { CreditBalanceCard } from "@/components/credit-balance-card";
import { ScoreBadge } from "@/components/score-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Candidate } from "@/lib/types";

interface CreditBalance {
  creditBalance: number;
  dailyQuotaRemaining: number;
  totalPurchased: number;
}

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const toneClasses = {
  slate: "border-slate-200 bg-white text-slate-950",
  blue: "border-blue-200 bg-blue-50 text-blue-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  red: "border-red-200 bg-red-50 text-red-950",
} as const;

const iconToneClasses = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
} as const;

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <Card className={`min-w-0 gap-4 rounded-lg shadow-sm ${toneClasses[tone]}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-0">
        <div className="min-w-0">
          <CardDescription className="text-sm font-medium text-slate-600">
            {label}
          </CardDescription>
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </CardTitle>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${iconToneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function ScreeningPipeline({
  pending,
  processing,
  completed,
  failed,
}: {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}) {
  const stages = [
    { label: "Pending", value: pending, className: "bg-slate-700" },
    { label: "Processing", value: processing, className: "bg-blue-600" },
    { label: "Completed", value: completed, className: "bg-emerald-600" },
    { label: "Failed", value: failed, className: "bg-red-600" },
  ];
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="gap-1">
        <CardTitle className="text-base text-slate-950">Screening pipeline</CardTitle>
        <CardDescription>
          Current candidate flow by review status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
          {stages.map((stage) => {
            const width = total > 0 ? `${Math.max((stage.value / total) * 100, stage.value ? 8 : 0)}%` : "25%";
            return (
              <div
                key={stage.label}
                className={stage.className}
                style={{ width }}
                aria-label={`${stage.label}: ${stage.value}`}
              />
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stages.map((stage) => (
            <div key={stage.label} className="rounded-md border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-full ${stage.className}`} />
                {stage.label}
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-950">
                {stage.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateMobileList({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {candidates.map((candidate) => (
        <Link
          key={candidate.id}
          href={`/candidates/${candidate.id}`}
          className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">
                {candidate.name}
              </h3>
              <p className="mt-1 truncate text-sm text-slate-500">
                {candidate.email || "No email"}
              </p>
            </div>
            <ScoreBadge score={candidate.overallScore} size="sm" />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <div className="flex min-w-0 items-center gap-2">
              <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{candidate.posisi || "No position"}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{candidate.fileName}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <StatusBadge status={candidate.status} />
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(candidate.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId") ?? "";
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

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
    batchId,
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
    const pending = candidates.filter((candidate) => candidate.status === "pending").length;
    const processing = candidates.filter((candidate) => candidate.status === "processing").length;
    const failed = candidates.filter((candidate) => candidate.status === "failed").length;
    const averageScore =
      completed.length > 0
        ? Math.round(
            completed.reduce(
              (sum, candidate) => sum + (candidate.overallScore ?? 0),
              0
            ) / completed.length
          )
        : "-";
    const completionRate =
      candidates.length > 0 ? Math.round((completed.length / candidates.length) * 100) : 0;

    return {
      todayCount,
      total: candidates.length,
      completed: completed.length,
      pending,
      processing,
      failed,
      active: pending + processing,
      averageScore,
      completionRate,
    };
  }, [candidates]);

  const handleDeleted = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <>
      <Header title="Dashboard" description="Operational view for CV screening">
        <Button asChild size="sm" className="bg-slate-950 text-white hover:bg-slate-800">
          <Link href="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload CV
          </Link>
        </Button>
      </Header>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50/70 p-4 pb-6 md:p-6">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5">
          <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-700">SuperHRD screening desk</p>
                  <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    Review candidates, spot blockers, and keep screening moving.
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    Use this page to monitor candidate throughput, failed screenings, and score readiness before moving into detailed review.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Button asChild className="bg-blue-700 text-white hover:bg-blue-800">
                    <Link href="/upload">
                      Upload CV
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-slate-300">
                    <Link href="/analytics">Open analytics</Link>
                  </Button>
                </div>
              </div>
            </div>

            {balance && (
              <CreditBalanceCard
                balance={balance.creditBalance}
                dailyQuotaRemaining={balance.dailyQuotaRemaining}
                totalPurchased={balance.totalPurchased}
              />
            )}
          </section>

          <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active screening"
              value={stats.active}
              description="Pending and processing candidates."
              icon={Clock3}
              tone="blue"
            />
            <StatCard
              label="Total candidates"
              value={stats.total}
              description={`${stats.todayCount} submitted today.`}
              icon={Users}
            />
            <StatCard
              label="Completion rate"
              value={`${stats.completionRate}%`}
              description={`${stats.completed} candidates completed.`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              label="Needs attention"
              value={stats.failed}
              description="Failed screenings to inspect."
              icon={AlertCircle}
              tone="red"
            />
          </section>

          <section className="grid min-w-0 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              <ScreeningPipeline
                pending={stats.pending}
                processing={stats.processing}
                completed={stats.completed}
                failed={stats.failed}
              />

              <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardHeader className="gap-1">
                  <CardTitle className="text-base text-slate-950">Score signal</CardTitle>
                  <CardDescription>
                    Average score from completed screenings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    <div className="text-4xl font-semibold tracking-tight text-slate-950">
                      {stats.averageScore}
                    </div>
                    <div className="pb-1 text-sm text-slate-500">average score</div>
                  </div>
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Completed screenings are the only records included in this score.
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="min-w-0 rounded-lg border-slate-200 bg-white shadow-sm">
              <CardHeader className="gap-4 border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg text-slate-950">
                      {batchId ? "Batch candidates" : "Candidate queue"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {batchId
                        ? "Showing candidates from the selected ZIP batch."
                        : "Recent candidates with status, score, and submitted time."}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <BarChart3 className="h-4 w-4 text-blue-700" />
                    {candidates.length} visible
                  </div>
                </div>

                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative min-w-0">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search name or email"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border-slate-200 bg-white pl-9"
                    />
                  </div>
                  <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                    <SelectTrigger className="w-full border-slate-200 bg-white">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusFilters.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label === "All" ? "All statuses" : item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {statusFilters.map((item) => {
                    const isActive = status === item.value;
                    return (
                      <Button
                        key={item.value}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className={isActive ? "bg-slate-950 text-white hover:bg-slate-800" : "border-slate-300 bg-white"}
                        onClick={() => setStatus(item.value)}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent className="min-w-0 p-4 sm:p-6">
                {isLoading ? (
                  <TableSkeleton rows={5} />
                ) : error ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                ) : candidates.length === 0 ? (
                  <EmptyState />
                ) : (
                  <>
                    <CandidateMobileList candidates={candidates} />
                    <div className="hidden min-w-0 overflow-hidden md:block">
                      <CandidatesTable candidates={candidates} onDeleted={handleDeleted} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </>
  );
}
