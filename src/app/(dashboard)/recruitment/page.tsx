"use client";

import { useCallback, useEffect, useState } from "react";
import { Columns3, Settings2, SlidersHorizontal, Star, Users, X } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/recruitment/kanban-board";
import { ManageFieldsDialog } from "@/components/recruitment/manage-fields-dialog";
import type { Candidate, CandidateFieldDefinition, PipelineStage } from "@/lib/types";

interface FieldFilter {
  fieldId: string;
  min?: string;
  max?: string;
}

export default function RecruitmentPage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [fields, setFields] = useState<CandidateFieldDefinition[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>([]);

  const fetchBoard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (scoreMin) params.set("scoreMin", scoreMin);
      if (scoreMax) params.set("scoreMax", scoreMax);
      const activeFilters = fieldFilters.filter((f) => f.min || f.max);
      if (activeFilters.length > 0) {
        params.set(
          "fieldFilters",
          JSON.stringify(
            activeFilters.map((f) => ({
              fieldId: f.fieldId,
              ...(f.min && { min: Number(f.min) }),
              ...(f.max && { max: Number(f.max) }),
            }))
          )
        );
      }

      const res = await fetch(`/api/recruitment/board?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load recruitment board");
      const data = await res.json();
      setStages(data.stages);
      setFields(data.fields);
      setCandidates(data.candidates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [scoreMin, scoreMax, fieldFilters]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchBoard(), 300);
    return () => clearTimeout(timer);
  }, [fetchBoard]);

  function handleCandidateUpdated(updated: Candidate) {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const numericFields = fields.filter((f) => f.type === "number" || f.type === "currency");
  const availableToAdd = numericFields.filter(
    (f) => !fieldFilters.some((ff) => ff.fieldId === f.id)
  );

  const scoredOnBoard = candidates.filter((c) => c.overallScore !== null);
  const boardAvgScore =
    scoredOnBoard.length > 0
      ? Math.round(
          scoredOnBoard.reduce((sum, c) => sum + (c.overallScore ?? 0), 0) / scoredOnBoard.length
        )
      : null;
  const terminalStageIds = new Set(stages.filter((s) => s.isTerminal).map((s) => s.id));
  const terminalCount = candidates.filter(
    (c) => c.pipelineStageId && terminalStageIds.has(c.pipelineStageId)
  ).length;

  const summaryTiles = [
    { label: "Candidates on board", value: candidates.length, icon: Users, tone: "bg-blue-50 text-blue-700 ring-blue-600/15" },
    { label: "Pipeline stages", value: stages.length, icon: Columns3, tone: "bg-violet-50 text-violet-700 ring-violet-600/15" },
    { label: "Average score", value: boardAvgScore ?? "-", icon: Star, tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
    { label: "Closed out", value: terminalCount, icon: X, tone: "bg-slate-100 text-slate-600 ring-slate-500/15" },
  ];

  return (
    <>
      <Header
        title="Recruitment"
        description="Track candidates through your own hiring pipeline, separate from AI screening."
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Recruitment" }]}
      >
        <Button
          size="sm"
          className="bg-blue-700 text-white hover:bg-blue-800"
          onClick={() => setManageFieldsOpen(true)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Manage fields
        </Button>
      </Header>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryTiles.map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {value}
                  </p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </section>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <SlidersHorizontal className="h-4 w-4 text-blue-700" />
              Filters
              <span className="text-xs font-normal text-slate-500">
                Combine AI score with your custom fields to shortlist faster.
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Score min</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={scoreMin}
                onChange={(e) => setScoreMin(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Score max</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="100"
                value={scoreMax}
                onChange={(e) => setScoreMax(e.target.value)}
                className="w-24"
              />
            </div>

            {fieldFilters.map((filter) => {
              const field = fields.find((f) => f.id === filter.fieldId);
              if (!field) return null;
              return (
                <div key={filter.fieldId} className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{field.label} min</Label>
                    <Input
                      type="number"
                      value={filter.min ?? ""}
                      onChange={(e) =>
                        setFieldFilters((prev) =>
                          prev.map((f) =>
                            f.fieldId === filter.fieldId ? { ...f, min: e.target.value } : f
                          )
                        )
                      }
                      className="w-32"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{field.label} max</Label>
                    <Input
                      type="number"
                      value={filter.max ?? ""}
                      onChange={(e) =>
                        setFieldFilters((prev) =>
                          prev.map((f) =>
                            f.fieldId === filter.fieldId ? { ...f, max: e.target.value } : f
                          )
                        )
                      }
                      className="w-32"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() =>
                      setFieldFilters((prev) => prev.filter((f) => f.fieldId !== filter.fieldId))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {availableToAdd.length > 0 && (
              <Select
                value=""
                onValueChange={(fieldId) =>
                  setFieldFilters((prev) => [...prev, { fieldId }])
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="+ Add filter" />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {stages.length === 0 && (
                <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-600/15">
                    <Columns3 className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-900">No pipeline stages yet</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Use &quot;Add stage&quot; below to create your first column and start moving candidates.
                  </p>
                </div>
              )}
              <KanbanBoard
                stages={stages}
                fields={fields}
                candidates={candidates}
                onStagesChange={setStages}
                onCandidateUpdated={handleCandidateUpdated}
              />
            </>
          )}
        </div>
      </main>

      <ManageFieldsDialog
        open={manageFieldsOpen}
        onOpenChange={setManageFieldsOpen}
        fields={fields}
        onFieldsChange={setFields}
      />
    </>
  );
}
