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
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Candidate } from "@/lib/types";
import { ScoreBadge } from "@/components/score-badge";
import { StatusBadge } from "@/components/status-badge";
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
          toast("Candidate already removed");
          setDeletedIds((prev) => new Set(prev).add(candidate.id));
          onDeleted?.(candidate.id);
          return;
        }
        if (!res.ok) {
          let message = "Failed to remove candidate";
          try {
            const body = await res.json();
            if (body?.error) message = body.error;
          } catch {
            // non-JSON response — keep default message
          }
          toast.error(message);
          return;
        }
        toast.success("Candidate removed");
        setDeletedIds((prev) => new Set(prev).add(candidate.id));
        onDeleted?.(candidate.id);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove candidate"
        );
      } finally {
        setIsDeleting(false);
        setConfirmTarget(null);
      }
    },
    [onDeleted]
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
            Name
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
            Position
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[160px] truncate">
              {row.original.posisi || "—"}
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
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email || "—"}
          </span>
        ),
      },
      {
        accessorKey: "fileName",
        header: "File",
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
            Score
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
        header: "Status",
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
            Submitted
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
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
                    aria-label="More candidate actions"
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
                    Remove candidate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        onDelete: (candidate: Candidate) => setConfirmTarget(candidate),
      } as ColumnDef<Candidate>,
    ],
    []
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
                  No candidates found.
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
            <DialogTitle>Remove candidate?</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <strong>{confirmTarget?.name}</strong>
              {confirmTarget?.posisi ? (
                <>
                  {" "}
                  for the <strong>{confirmTarget.posisi}</strong> position
                </>
              ) : null}
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={isDeleting}
            >
              Cancel
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
                  Removing...
                </>
              ) : (
                "Remove candidate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
