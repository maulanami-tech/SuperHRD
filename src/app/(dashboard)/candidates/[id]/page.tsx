"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Candidate, CriteriaItem } from "@/lib/types";
import { isProcessingTimedOut } from "@/lib/candidate-status";
import { StatusBadge } from "@/components/status-badge";
import { ScoreBadge } from "@/components/score-badge";
import { ScreeningResults } from "@/components/screening-results";
import { CandidateDetailSkeleton } from "@/components/loading-skeleton";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCandidate = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidates/${id}`);
      if (res.status === 404) {
        setError("Candidate not found");
        setCandidate(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to load candidate");
      const data: Candidate = await res.json();
      setCandidate(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchRef = useRef(fetchCandidate);
  useEffect(() => {
    fetchRef.current = fetchCandidate;
  }, [fetchCandidate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCandidate();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCandidate]);

  useEffect(() => {
    if (candidate?.status === "processing" || candidate?.status === "pending") {
      const interval = setInterval(() => fetchRef.current(), 10000);
      return () => clearInterval(interval);
    }
  }, [candidate?.status]);

  // Client-side refresh while a candidate is still processing: bump a tick
  // counter so render-time timeout evaluation (isProcessingTimedOut) picks
  // up wall-clock progress. The actual timeout decision is derived during
  // render, not stored as state, to keep the effect side-effect-free.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (candidate?.status !== "processing") return;
    const interval = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(interval);
  }, [candidate?.status]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
      if (res.status === 404) {
        toast("Candidate already removed");
        router.replace("/dashboard");
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
      router.replace("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove candidate"
      );
    } finally {
      setIsDeleting(false);
      setShowDelete(false);
    }
  }, [id, router]);

  if (loading) {
    return (
      <>
        <Header
          title="Candidate"
          description="Loading candidate details"
          breadcrumb={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Candidate" },
          ]}
        />
        <main className="flex-1 p-4 md:p-6">
          <CandidateDetailSkeleton />
        </main>
      </>
    );
  }

  if (error || !candidate) {
    return (
      <>
        <Header
          title="Candidate"
          description="Candidate details"
          breadcrumb={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Candidate" },
          ]}
        />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground">
              {error || "Candidate not found"}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button variant="outline" onClick={fetchCandidate}>
                Try again
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  let criteria: CriteriaItem[] = [];
  if (candidate.screeningResult?.criteria) {
    try {
      criteria = JSON.parse(candidate.screeningResult.criteria);
    } catch {
      criteria = [];
    }
  }

  const showProcessingTimeoutHint =
    candidate.status === "processing" &&
    isProcessingTimedOut({
      status: candidate.status,
      updatedAt: new Date(candidate.updatedAt),
    });

  return (
    <>
      <Header
        title={candidate.name}
        description={`Submitted by ${candidate.submittedBy}`}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Candidates", href: "/dashboard" },
          { label: candidate.name },
        ]}
      >
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => setShowDelete(true)}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remove
        </Button>
      </Header>

      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">{candidate.name}</CardTitle>
                <CardDescription className="mt-1">
                  Submitted{" "}
                  {formatDistanceToNow(new Date(candidate.createdAt), {
                    addSuffix: true,
                  })}{" "}
                  by {candidate.submittedBy}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={candidate.status} />
                <ScoreBadge score={candidate.overallScore} size="lg" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {candidate.posisi || "No position"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {candidate.email || "No email"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{candidate.fileName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {new Date(candidate.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {candidate.status === "processing" && !showProcessingTimeoutHint && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted" />
                <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary" />
              </div>
              <h3 className="mt-6 text-lg font-semibold">
                AI is screening this CV...
              </h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Results will appear here once the analysis is complete.
                <br />
                This page refreshes automatically.
              </p>
            </CardContent>
          </Card>
        )}

        {showProcessingTimeoutHint && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <RefreshCw className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                Screening timed out
              </h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                The AI screening has been running for more than 30 minutes and
                is considered failed.
                <br />
                Please try uploading the CV again.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/upload")}
              >
                Upload Again
              </Button>
            </CardContent>
          </Card>
        )}

        {candidate.status === "pending" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <User className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                Waiting to be processed
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This candidate is queued for AI screening.
              </p>
            </CardContent>
          </Card>
        )}

        {candidate.status === "failed" && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <RefreshCw className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Screening Failed</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Something went wrong during the AI screening.
                <br />
                Please try uploading the CV again.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/upload")}
              >
                Upload Again
              </Button>
            </CardContent>
          </Card>
        )}

        {candidate.status === "completed" && candidate.screeningResult && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle>Screening Results</CardTitle>
              </CardHeader>
              <CardContent>
                <ScreeningResults
                  overallScore={candidate.screeningResult.overallScore}
                  summary={candidate.screeningResult.summary}
                  criteria={criteria}
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog
        open={showDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setShowDelete(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove candidate?</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <strong>{candidate.name}</strong>
              {candidate.posisi ? (
                <>
                  {" "}
                  for the <strong>{candidate.posisi}</strong> position
                </>
              ) : null}
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
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
