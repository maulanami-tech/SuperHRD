"use client";

import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Briefcase,
  FileText,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Candidate } from "@/lib/types";
import { ScoreBadge } from "@/components/score-badge";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/components/i18n-provider";
import { formatRelativeDate } from "@/lib/i18n/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CandidatesTableProps {
  candidates: Candidate[];
  onDeleted?: (id: string) => void;
}

interface ActionColumnDef {
  onDelete?: (candidate: Candidate) => void;
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest(
      'button, a, input, select, textarea, [role="button"], [role="menuitem"], [data-row-action="true"]'
    )
  );
}

export function CandidatesTable({
  candidates,
  onDeleted,
}: CandidatesTableProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [confirmTarget, setConfirmTarget] = useState<Candidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDelete = useCallback(
    async (candidate: Candidate) => {
      setIsDeleting(true);
      try {
        const res = await fetch(`/api/candidates/${candidate.id}`, {
          method: "DELETE",
        });
        if (res.status === 404) {
          toast(t("candidates.alreadyRemoved"));
          setDeletedIds((prev) => new Set(prev).add(candidate.id));
          onDeleted?.(candidate.id);
          return;
        }
        if (!res.ok) {
          let message = t("candidates.removeFailed");
          try {
            const body = await res.json();
            if (body?.error) message = body.error;
          } catch {
            // Keep default message for non-JSON responses.
          }
          toast.error(message);
          return;
        }
        toast.success(t("candidates.removed"));
        setDeletedIds((prev) => new Set(prev).add(candidate.id));
        onDeleted?.(candidate.id);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t("candidates.removeFailed")
        );
      } finally {
        setIsDeleting(false);
        setConfirmTarget(null);
      }
    },
    [onDeleted, t]
  );

  const columns = useMemo<ColumnDef<Candidate>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-4 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("auth.name")}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        id: "posisi",
        accessorKey: "posisi",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-4 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("common.position")}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[160px] truncate">
              {row.original.posisi || "-"}
            </span>
          </span>
        ),
        sortingFn: (rowA, rowB) => {
          const a = (rowA.original.posisi ?? "").toLowerCase();
          const b = (rowB.original.posisi ?? "").toLowerCase();
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "email",
        header: t("common.email"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email || "-"}
          </span>
        ),
      },
      {
        accessorKey: "fileName",
        header: t("common.file"),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[140px] truncate">
              {row.original.fileName}
            </span>
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "score",
        accessorKey: "overallScore",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-4 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("common.score")}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <ScoreBadge score={row.original.overallScore} />,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.overallScore ?? -1;
          const b = rowB.original.overallScore ?? -1;
          return a - b;
        },
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: false,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-4 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("common.submitted")}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatRelativeDate(row.original.createdAt, locale)}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">{t("common.actions")}</span>,
        cell: ({ row, column }) => {
          const onDelete = (column.columnDef as ActionColumnDef).onDelete;
          return (
            <div
              className="flex justify-end"
              data-row-action="true"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={t("candidates.moreActions")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      onDelete?.(row.original);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("candidates.remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        onDelete: (candidate: Candidate) => setConfirmTarget(candidate),
      } as ColumnDef<Candidate>,
    ],
    [locale, t]
  );

  const table = useReactTable({
    data: candidates,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(event) => {
                    if (isInteractiveTarget(event.target)) return;
                    if (!deletedIds.has(row.original.id)) {
                      router.push(`/candidates/${row.original.id}`);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("candidates.noneFound")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setConfirmTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("candidates.removeQuestion")}</DialogTitle>
            <DialogDescription>
              {t("candidates.removeDescriptionPrefix")} {" "}
              <strong>{confirmTarget?.name}</strong>
              {confirmTarget?.posisi ? (
                <>
                  {" "}
                  {t("candidates.removeDescriptionMiddle")} <strong>{confirmTarget.posisi}</strong>{" "}
                  {t("common.position")}
                </>
              ) : null}
              {confirmTarget?.posisi ? "" : "."} {t("candidates.removeDescriptionSuffix")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmTarget) void handleDelete(confirmTarget);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("candidates.removing")}
                </>
              ) : (
                t("candidates.remove")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
