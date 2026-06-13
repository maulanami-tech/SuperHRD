"use client";

import Link from "next/link";
import {
  Activity,
  Briefcase,
  CheckCircle2,
  FileUp,
  Trophy,
  Users,
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

const scoreBuckets = [
  { label: "0-20", min: 0, max: 20, className: "bg-red-500" },
  { label: "21-40", min: 21, max: 40, className: "bg-orange-500" },
  { label: "41-60", min: 41, max: 60, className: "bg-amber-500" },
  { label: "61-80", min: 61, max: 80, className: "bg-emerald-500" },
  { label: "81-100", min: 81, max: 100, className: "bg-green-600" },
];

function averageScore(candidates: Candidate[]) {
  const scored = candidates.filter((candidate) => candidate.overallScore !== null);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((sum, candidate) => sum + (candidate.overallScore ?? 0), 0) /
      scored.length
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { candidates, isLoading, error } = useCandidates({
    pollingInterval: 15000,
  });

  const completed = candidates.filter((candidate) => candidate.status === "completed");
  const scoredCandidates = candidates.filter(
    (candidate) => candidate.overallScore !== null
  );
  const avgScore = averageScore(scoredCandidates);
  const topCandidates = [...scoredCandidates]
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .slice(0, 5);

  const statusCounts = ["completed", "processing", "pending", "failed"].map(
    (status) => ({
      status,
      count: candidates.filter((candidate) => candidate.status === status).length,
      percentage:
        candidates.length > 0
          ? Math.round(
              (candidates.filter((candidate) => candidate.status === status).length /
                candidates.length) *
                100
            )
          : 0,
    })
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
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxPositionCount = Math.max(...positions.map((position) => position.count), 1);

  return (
    <>
      <Header
        title="Analytics"
        description="Screening performance and hiring insights"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Analytics" }]}
      >
        <Button asChild size="sm">
          <Link href="/upload">
            <FileUp className="mr-2 h-4 w-4" />
            Upload CV
          </Link>
        </Button>
      </Header>

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {isLoading ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-lg" />
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Skeleton className="h-80 rounded-lg" />
              <Skeleton className="h-80 rounded-lg" />
            </div>
          </>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total Screened"
                value={candidates.length}
                description="Candidates submitted"
                icon={Users}
              />
              <StatCard
                title="Completed"
                value={completed.length}
                description="Screenings with results"
                icon={CheckCircle2}
              />
              <StatCard
                title="Average Score"
                value={avgScore ?? "-"}
                description="Across scored candidates"
                icon={Activity}
              />
              <StatCard
                title="Positions"
                value={positions.length}
                description="Roles represented"
                icon={Briefcase}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>
                    Candidate score spread across completed screenings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scoredCandidates.length === 0 ? (
                    <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      No scored candidates yet
                    </div>
                  ) : (
                    <div className="flex h-56 items-end gap-3">
                      {bucketCounts.map((bucket) => (
                        <div
                          key={bucket.label}
                          className="flex flex-1 flex-col items-center gap-2"
                        >
                          <div className="flex h-44 w-full items-end rounded-md bg-muted">
                            <div
                              className={`w-full rounded-md ${bucket.className}`}
                              style={{
                                height: `${Math.max(
                                  (bucket.count / maxBucketCount) * 100,
                                  bucket.count > 0 ? 8 : 0
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-medium">{bucket.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {bucket.count}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Position Insights</CardTitle>
                  <CardDescription>
                    Most active roles and their average score
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {positions.length === 0 ? (
                    <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      No position data yet
                    </div>
                  ) : (
                    positions.map((position) => (
                      <div key={position.name} className="space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {position.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {position.count} candidate
                              {position.count === 1 ? "" : "s"}
                            </p>
                          </div>
                          <ScoreBadge score={position.average} />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
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
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                  <CardDescription>Current screening pipeline</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {statusCounts.map(({ status, count, percentage }) => (
                    <div key={status} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={status} />
                        <span className="text-sm text-muted-foreground">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Candidates</CardTitle>
                  <CardDescription>Highest scoring completed screenings</CardDescription>
                </CardHeader>
                <CardContent>
                  {topCandidates.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed text-center">
                      <Trophy className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No scored candidates yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topCandidates.map((candidate) => (
                        <Link
                          key={candidate.id}
                          href={`/candidates/${candidate.id}`}
                          className="flex items-center justify-between gap-4 rounded-md border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {candidate.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {candidate.posisi || candidate.email || candidate.fileName}
                            </p>
                          </div>
                          <ScoreBadge score={candidate.overallScore} />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
