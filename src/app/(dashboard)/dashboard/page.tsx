"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Search, Upload } from "lucide-react";
import { useCandidates } from "@/hooks/use-candidates";
import { CandidatesTable } from "@/components/candidates-table";
import { Header } from "@/components/header";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");

  const debounce = useCallback((value: string) => {
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = debounce(search);
    return cleanup;
  }, [search, debounce]);

  const { candidates, isLoading, error } = useCandidates({
    search: debouncedSearch,
    status: status === "all" ? "" : status,
  });

  return (
    <>
      <Header title="Candidate Screening" description="Review AI-scored CVs">
        <Button asChild size="sm">
          <Link href="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload New
          </Link>
        </Button>
      </Header>

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[160px]">
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

        {isLoading ? (
          <div className="rounded-md border p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <CandidatesTable candidates={candidates} />
          </div>
        )}
      </main>
    </>
  );
}
