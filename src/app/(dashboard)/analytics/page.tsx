"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileUp,
  ListChecks,
  ShieldAlert,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { Header } from "@/components/header";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidates } from "@/hooks/use-candidates";
import type { Candidate } from "@/lib/types";
import { cn } from "@/lib/utils";

const scoreBuckets = [
  { label: "0-20", min: 0, max: 20, className: "bg-red-500", tone: "Weak fit" },
  { label: "21-40", min: 21, max: 40, className: "bg-orange-500", tone: "Low fit" },
  { label: "41-60", min: 41, max: 60, className: "bg-amber-500", tone: "Review" },
  { label: "61-80", min: 61, max: 80, className: "bg-emerald-500", tone: "Qualified" },
  { label: "81-100", min: 81, max: 100, className: "bg-green-600", tone: "Top fit" },
];

const statusMeta = {
  completed: {
    label: "Completed",
    description: "Ready to review",
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    surface: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  processing: {
    label: "Processing",
    description: "AI screening running",
    icon: Activity,
    bar: "bg-blue-500",
    surface: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  pending: {
    label: "Pending",
    description: "Waiting in queue",
    icon: Clock3,
    bar: "bg-slate-400",
    surface: "bg-slate-100 text-slate-700 ring-slate-500/20",
  },
  failed: {
    label: "Failed",
    description: "Needs attention",
    icon: XCircle,
    bar: "bg-red-500",
    surface: "bg-red-50 text-red-700 ring-red-600/20",
  },
} as const;

type CandidateStatus = keyof typeof statusMeta;

function averageScore(candidates: Candidate[]) {
  const scored = candidates.filter((candidate) => candidate.overallScore !== null);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((sum, candidate) => sum + (candidate.overallScore ?? 0), 0) /
      scored.length
  );
}

function percentage(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "blue" | "emerald" | "amber" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
    red: "bg-red-50 text-red-700 ring-red-600/15",
  };

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
              {value}
            </div>
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { candidates, isLoading, error } = useCandidates({
    pollingInterval: 15000,
  });

  const completed = candidates.filter((candidate) => candidate.status === "completed");
  const failed = candidates.filter((candidate) => candidate.status === "failed");
  const processing = candidates.filter((candidate) => candidate.status === "processing");
  const pending = candidates.filter((candidate) => candidate.status === "pending");
  const scoredCandidates = candidates.filter(
    (candidate) => candidate.overallScore !== null
  );
  const avgScore = averageScore(scoredCandidates);
  const completionRate = percentage(completed.length, candidates.length);
  const failureRate = percentage(failed.length, candidates.length);
  const topCandidates = [...scoredCandidates]
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .slice(0, 5);

  const statusCounts = (["completed", "processing", "pending", "failed"] as CandidateStatus[]).map(
    (status) => {
      const count = candidates.filter((candidate) => candidate.status === status).length;
      return {
        status,
        count,
        percentage: percentage(count, candidates.length),
      };
    }
  );

  const bucketCounts = scoreBuckets.map((bucket) => ({
    ...bucket,
    count: scoredCandidates.filter((candidate) => {
      const score = candidate.overallScore ?? 0;
      return score >= bucket.min && score <= bucket.max;
    }).length,
  }));
  const maxBucketCount = Math.max(...bucketCounts.map((bucket) => bucket.count), 1);

  const positions = Object.values(
    candidates.reduce<Record<string, { name: string; candidates: Candidate[] }>>(
      (acc, candidate) => {
        const key = candidate.posisi?.trim() || "Unspecified";
        acc[key] ??= { name: key, candidates: [] };
        acc[key].candidates.push(candidate);
        return acc;
      },
      {}
    )
  )
    .map((position) => ({
      name: position.name,
      count: position.candidates.length,
      average: averageScore(position.candidates),
      completed: position.candidates.filter((candidate) => candidate.status === "completed").length,
      failed: position.candidates.filter((candidate) => candidate.status === "failed").length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxPositionCount = Math.max(...positions.map((position) => position.count), 1);

  return (
    <>
      <Header
        title="Screening analytics"
        description="Pipeline health and hiring quality signals"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Analytics" }]}
      >
        <Button asChild size="sm" className="bg-blue-700 text-white hover:bg-blue-800">
          <Link href="/upload">
            <FileUp className="mr-2 h-4 w-4" />
            Upload CV
          </Link>
        </Button>
      </Header>

      <main className="min-w-0 flex-1 space-y-5 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        {isLoading ? (
          <>
            <Skeleton className="h-48 rounded-lg" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-36 rounded-lg" />
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <Skeleton className="h-80 rounded-lg" />
              <Skeleton className="h-80 rounded-lg" />
            </div>
          </>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-blue-100 bg-gradient-to-br from-white via-blue-50/80 to-emerald-50/70 shadow-sm">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-5 sm:p-6 lg:p-7">
                  <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-800 shadow-sm">
                    <BarChart3 className="h-4 w-4" />
                    Hiring intelligence
                  </div>
                  <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    See where the screening pipeline needs attention.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                    Track candidate volume, completion health, score coverage, and role demand from the same screening queue.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">Candidates</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">{candidates.length}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">Completion rate</p>
                      <p className="mt-2 text-xl font-semibold text-emerald-700 sm:text-2xl">{completionRate}%</p>
                    </div>
                    <div className="rounded-lg border border-red-100 bg-white p-3 shadow-sm sm:p-4">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">Failed</p>
                      <p className="mt-2 text-xl font-semibold text-red-700 sm:text-2xl">{failed.length}</p>
                    </div>
                  </div>
                </div>

                <div className="hidden border-t border-blue-100 bg-white/75 p-5 lg:block lg:border-l lg:border-t-0 lg:p-6">
                  <p className="text-sm font-semibold text-slate-950">Queue snapshot</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Current status across all submitted candidates.
                  </p>
                  <div className="mt-5 space-y-3">
                    {statusCounts.map(({ status, count, percentage: statusPercentage }) => {
                      const meta = statusMeta[status];
                      const Icon = meta.icon;
                      return (
                        <div key={status} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1", meta.surface)}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-950">{meta.label}</p>
                                <p className="text-xs text-slate-500">{meta.description}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold tabular-nums text-slate-950">
                              {count}
                            </p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={cn("h-full rounded-full", meta.bar)} style={{ width: `${statusPercentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {failed.length > 0 && (
              <section className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-red-200">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-900">
                        {pluralize(failed.length, "screening")} failed
                      </p>
                      <p className="mt-1 text-sm text-red-700">
                        Review failed submissions before treating analytics as complete.
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="border-red-200 bg-white text-red-700 hover:bg-red-100">
                    <Link href="/dashboard">
                      Review queue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </section>
            )}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total candidates"
                value={candidates.length}
                description={`${pluralize(completed.length, "completed screening")} from all submissions`}
                icon={Users}
              />
              <StatCard
                title="Completion rate"
                value={`${completionRate}%`}
                description={(processing.length + pending.length) > 0 ? `${pluralize(processing.length + pending.length, "candidate")} still in queue` : "No candidates waiting"}
                icon={CheckCircle2}
                tone="emerald"
              />
              <StatCard
                title="Failed screenings"
                value={failed.length}
                description={failureRate > 0 ? `${failureRate}% of current intake` : "No failed screenings"}
                icon={AlertTriangle}
                tone={failed.length > 0 ? "red" : "emerald"}
              />
              <StatCard
                title="Average score"
                value={avgScore ?? "-"}
                description={
                  scoredCandidates.length > 0
                    ? `Across ${pluralize(scoredCandidates.length, "scored candidate")}`
                    : "Waiting for scored results"
                }
                icon={Activity}
                tone="blue"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Screening pipeline health</CardTitle>
                      <CardDescription>Status distribution across submitted CVs</CardDescription>
                    </div>
                    <div className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {candidates.length} total
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {statusCounts.map(({ status, count, percentage: statusPercentage }) => {
                    const meta = statusMeta[status];
                    return (
                      <div key={status} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <StatusBadge status={status} />
                            <span className="truncate text-sm text-slate-500">{meta.description}</span>
                          </div>
                          <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                            {count} ({statusPercentage}%)
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full rounded-full", meta.bar)} style={{ width: `${statusPercentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Role coverage</CardTitle>
                  <CardDescription>Most active roles and current review quality</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {positions.length === 0 ? (
                    <EmptyPanel
                      icon={BriefcaseBusiness}
                      title="No role data yet"
                      description="Upload candidates with a target position to compare role demand."
                    />
                  ) : (
                    positions.map((position) => (
                      <div key={position.name} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {position.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {pluralize(position.count, "candidate")} · {position.completed} completed · {position.failed} failed
                            </p>
                          </div>
                          <ScoreBadge score={position.average} />
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{
                              width: `${(position.count / maxPositionCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
              <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Score distribution</CardTitle>
                  <CardDescription>Candidate score spread across completed screenings</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoredCandidates.length === 0 ? (
                    <EmptyPanel
                      icon={ListChecks}
                      title="No scored candidates yet"
                      description="Completed screenings will appear here as a distribution by score range."
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex h-56 items-end gap-3">
                        {bucketCounts.map((bucket) => (
                          <div
                            key={bucket.label}
                            className="flex min-w-0 flex-1 flex-col items-center gap-2"
                          >
                            <div className="flex h-44 w-full items-end rounded-lg bg-slate-100">
                              <div
                                className={cn("w-full rounded-lg", bucket.className)}
                                style={{
                                  height: `${Math.max(
                                    (bucket.count / maxBucketCount) * 100,
                                    bucket.count > 0 ? 8 : 0
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="text-center">
                              <div className="text-xs font-medium text-slate-700">{bucket.label}</div>
                              <div className="text-xs text-slate-500">{bucket.count}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-5">
                        {bucketCounts.map((bucket) => (
                          <div key={bucket.tone} className="rounded-md bg-slate-50 p-2 text-center">
                            <p className="text-xs font-medium text-slate-700">{bucket.tone}</p>
                            <p className="text-xs text-slate-500">{bucket.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Top candidates</CardTitle>
                      <CardDescription>Highest scoring completed screenings</CardDescription>
                    </div>
                    <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                      <Link href="/dashboard">View all</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {topCandidates.length === 0 ? (
                    <EmptyPanel
                      icon={Trophy}
                      title="No ranked candidates yet"
                      description="Once screening completes, the strongest candidates will be ranked here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {topCandidates.map((candidate, index) => (
                        <Link
                          key={candidate.id}
                          href={`/candidates/${candidate.id}`}
                          className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-600/15">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-950">
                                {candidate.name}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {candidate.posisi || candidate.email || candidate.fileName}
                              </p>
                            </div>
                          </div>
                          <ScoreBadge score={candidate.overallScore} />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </>
  );
}