"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PositionFormDialog } from "@/components/positions/position-form-dialog";
import { PositionStatusBadge } from "@/components/positions/position-status-badge";
import type { JobPositionListItem, JobPositionStatus } from "@/lib/types";

export default function PositionsPage() {
  const { t } = useI18n();
  const [positions, setPositions] = useState<JobPositionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<JobPositionListItem | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/positions");
      if (!res.ok) throw new Error(t("positions.loadError"));
      const data = await res.json();
      setPositions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  function openCreateDialog() {
    setEditingPosition(null);
    setDialogOpen(true);
  }

  function openEditDialog(position: JobPositionListItem) {
    setEditingPosition(position);
    setDialogOpen(true);
  }

  function handleSaved(saved: JobPositionListItem) {
    setPositions((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p));
      }
      return [{ ...saved, candidateCount: 0, avgScore: null }, ...prev];
    });
  }

  async function changeStatus(position: JobPositionListItem, status: JobPositionStatus) {
    setPendingStatusId(position.id);
    try {
      const res = await fetch(`/api/positions/${position.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || t("positions.loadError"));
      }
      setPositions((prev) =>
        prev.map((p) => (p.id === position.id ? { ...p, status } : p))
      );
      toast.success(t("positions.updateSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("positions.loadError"));
    } finally {
      setPendingStatusId(null);
    }
  }

  return (
    <>
      <Header
        title={t("positions.title")}
        description={t("positions.description")}
        breadcrumb={[{ label: t("common.dashboard"), href: "/dashboard" }, { label: t("positions.navTitle") }]}
      >
        <Button onClick={openCreateDialog} className="bg-blue-700 text-white hover:bg-blue-800">
          <Plus className="mr-2 h-4 w-4" />
          {t("positions.newPosition")}
        </Button>
      </Header>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-3 h-4 w-full max-w-md" />
                  <Skeleton className="mt-4 h-4 w-64" />
                </Card>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 rounded-lg border-dashed border-slate-300 bg-white p-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Briefcase className="h-6 w-6" />
              </div>
              <p className="max-w-sm text-sm text-slate-500">{t("positions.noPositions")}</p>
              <Button onClick={openCreateDialog} className="mt-2 bg-blue-700 text-white hover:bg-blue-800">
                <Plus className="mr-2 h-4 w-4" />
                {t("positions.newPosition")}
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {positions.map((position) => (
                <Card
                  key={position.id}
                  className="group rounded-lg border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/positions/${position.id}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-950 group-hover:text-blue-700">
                          {position.title}
                        </h3>
                        <PositionStatusBadge status={position.status} />
                      </div>
                      {position.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {position.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {position.candidateCount} {t("positions.candidateCount").toLowerCase()}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                          {t("positions.avgScore")}: {position.avgScore != null ? position.avgScore.toFixed(1) : "—"}
                        </span>
                      </div>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          disabled={pendingStatusId === position.id}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEditDialog(position)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("positions.editPosition")}
                        </DropdownMenuItem>
                        {position.status === "open" && (
                          <DropdownMenuItem onSelect={() => changeStatus(position, "closed")}>
                            <Lock className="mr-2 h-4 w-4" />
                            {t("positions.close")}
                          </DropdownMenuItem>
                        )}
                        {position.status === "closed" && (
                          <DropdownMenuItem onSelect={() => changeStatus(position, "open")}>
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            {t("positions.reopen")}
                          </DropdownMenuItem>
                        )}
                        {position.status !== "archived" && (
                          <DropdownMenuItem onSelect={() => changeStatus(position, "archived")}>
                            <Archive className="mr-2 h-4 w-4" />
                            {t("positions.archive")}
                          </DropdownMenuItem>
                        )}
                        {position.status === "archived" && (
                          <DropdownMenuItem onSelect={() => changeStatus(position, "open")}>
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            {t("positions.reopen")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <PositionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        position={editingPosition}
        onSaved={handleSaved}
      />
    </>
  );
}
