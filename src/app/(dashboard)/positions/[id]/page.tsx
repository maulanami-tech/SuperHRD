"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  ChevronDown,
  Lock,
  Pencil,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidatesTable } from "@/components/candidates-table";
import { PositionFormDialog } from "@/components/positions/position-form-dialog";
import { PositionStatusBadge } from "@/components/positions/position-status-badge";
import type { Candidate, JobPositionDetail, JobPositionListItem, JobPositionStatus } from "@/lib/types";

export default function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useI18n();
  const [position, setPosition] = useState<JobPositionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [statusPending, setStatusPending] = useState(false);

  const fetchPosition = useCallback(async () => {
    try {
      const res = await fetch(`/api/positions/${id}`);
      if (res.status === 404) {
        setError(t("positions.loadError"));
        return;
      }
      if (!res.ok) throw new Error(t("positions.loadError"));
      const data = await res.json();
      setPosition(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  async function changeStatus(status: JobPositionStatus) {
    if (!position) return;
    setStatusPending(true);
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("positions.loadError"));
      setPosition((prev) => (prev ? { ...prev, status } : prev));
      toast.success(t("positions.updateSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("positions.loadError"));
    } finally {
      setStatusPending(false);
    }
  }

  function handleSaved(saved: JobPositionListItem) {
    setPosition((prev) => (prev ? { ...prev, ...saved } : prev));
  }

  if (isLoading) {
    return (
      <>
        <Header title={t("positions.navTitle")} />
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (error || !position) {
    return (
      <>
        <Header title={t("positions.navTitle")} />
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-5xl">
            <Card className="p-8 text-center text-sm text-red-700">
              {error || t("positions.loadError")}
              <div className="mt-4">
                <Button variant="outline" onClick={() => router.push("/positions")}>
                  {t("positions.navTitle")}
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </>
    );
  }

  const avgScore =
    position.candidates.filter((c) => c.overallScore != null).length > 0
      ? position.candidates.reduce((sum, c) => sum + (c.overallScore ?? 0), 0) /
        position.candidates.filter((c) => c.overallScore != null).length
      : null;

  return (
    <>
      <Header
        title={position.title}
        breadcrumb={[
          { label: t("common.dashboard"), href: "/dashboard" },
          { label: t("positions.navTitle"), href: "/positions" },
          { label: position.title },
        ]}
      >
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t("positions.editPosition")}
        </Button>
      </Header>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5">
          <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-slate-950">{position.title}</h1>
                    <PositionStatusBadge status={position.status} />
                  </div>
                  {position.description && (
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">{position.description}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {position.status === "open" && (
                  <Button variant="outline" size="sm" disabled={statusPending} onClick={() => changeStatus("closed")}>
                    <Lock className="mr-2 h-4 w-4" />
                    {t("positions.close")}
                  </Button>
                )}
                {position.status === "closed" && (
                  <Button variant="outline" size="sm" disabled={statusPending} onClick={() => changeStatus("open")}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    {t("positions.reopen")}
                  </Button>
                )}
                {position.status !== "archived" ? (
                  <Button variant="outline" size="sm" disabled={statusPending} onClick={() => changeStatus("archived")}>
                    <Archive className="mr-2 h-4 w-4" />
                    {t("positions.archive")}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled={statusPending} onClick={() => changeStatus("open")}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    {t("positions.reopen")}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  {t("positions.candidateCount")}
                </div>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{position.candidates.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {t("positions.avgScore")}
                </div>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {avgScore != null ? avgScore.toFixed(1) : "—"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBriefOpen((v) => !v)}
              className="mt-4 flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-700" />
                Kriteria & Prompt
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${briefOpen ? "rotate-180" : ""}`} />
            </button>
            {briefOpen && (
              <div className="mt-2 grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("positions.fieldKriteria")}
                  </p>
                  <p className="whitespace-pre-wrap">{position.kriteria}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("positions.fieldPrompt")}
                  </p>
                  <p className="whitespace-pre-wrap">{position.prompt}</p>
                </div>
              </div>
            )}
          </Card>

          <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-base text-slate-950">
                {t("positions.detailRankingTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {position.candidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  {t("empty.candidatesDescription")}
                </p>
              ) : (
                <CandidatesTable
                  candidates={position.candidates as unknown as Candidate[]}
                  onDeleted={(id) =>
                    setPosition((prev) =>
                      prev
                        ? { ...prev, candidates: prev.candidates.filter((c) => c.id !== id) }
                        : prev
                    )
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <PositionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        position={position as unknown as JobPositionListItem}
        onSaved={handleSaved}
      />
    </>
  );
}
