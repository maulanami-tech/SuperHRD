"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface TopupRequest {
  id: string;
  amountIdr: number;
  creditAmount: number;
  paymentMethod: string;
  status: "pending" | "approved" | "rejected" | "expired";
  proofImageUrl: string | null;
  notes: string | null;
  paymentProvider: string;
  providerOrderId: string | null;
  providerStatus: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    creditBalance: number;
  };
}

const statuses = ["pending", "approved", "rejected", "expired", "all"];

const statusClasses: Record<TopupRequest["status"], string> = {
  pending: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  expired: "bg-slate-100 text-slate-700 ring-1 ring-slate-600/20",
};

export function TopupRequestsClient() {
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TopupRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proofTarget, setProofTarget] = useState<TopupRequest | null>(null);

  useEffect(() => {
    async function fetchRequests() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/topup-requests?status=${filter}`);
        if (!res.ok) throw new Error("Failed to load requests");
        const data: { requests?: TopupRequest[] } = await res.json();
        setRequests(data.requests || []);
      } catch {
        toast.error("Failed to load requests");
      } finally {
        setLoading(false);
      }
    }
    void fetchRequests();
  }, [filter]);

  async function refreshRequests() {
    const res = await fetch(`/api/admin/topup-requests?status=${filter}`);
    if (!res.ok) return;
    const data: { requests?: TopupRequest[] } = await res.json();
    setRequests(data.requests || []);
  }

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/topup/${id}/approve`, {
        method: "POST",
      });
      const data: { error?: string; creditAmount?: number } = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to approve");
      toast.success(`Approved. ${data.creditAmount ?? 0} credits added.`);
      await refreshRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve request");
    } finally {
      setProcessing(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;

    setProcessing(rejectTarget.id);
    try {
      const res = await fetch(`/api/admin/topup/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: rejectReason.trim() }),
      });

      if (!res.ok) throw new Error("Failed to reject");
      toast.success("Request rejected");
      setRejectTarget(null);
      setRejectReason("");
      await refreshRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject request");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Top-Up Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage QRIS top-up approvals.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-lg" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No requests found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {request.user.name}
                      </CardTitle>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {request.user.email}
                      </p>
                    </div>
                    <Badge className={statusClasses[request.status]}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current balance</p>
                      <p className="font-medium">
                        {request.user.creditBalance} credits
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Method</p>
                      <p className="font-medium">
                        {request.paymentMethod.toUpperCase()} / {request.paymentProvider}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">
                        Rp {request.amountIdr.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Credits</p>
                      <p className="font-medium">{request.creditAmount}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Submitted</p>
                      <p className="font-medium">
                        {new Date(request.createdAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                    {request.providerOrderId && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Provider order</p>
                        <p className="break-all font-medium">
                          {request.providerOrderId}
                        </p>
                      </div>
                    )}
                    {request.providerStatus && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Provider status</p>
                        <p className="font-medium">{request.providerStatus}</p>
                      </div>
                    )}
                  </div>

                  {request.proofImageUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProofTarget(request)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Payment Proof
                    </Button>
                  )}

                  {request.notes && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">Notes</p>
                      <p className="mt-1 text-muted-foreground">{request.notes}</p>
                    </div>
                  )}

                  {request.status === "pending" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        onClick={() => void handleApprove(request.id)}
                        disabled={processing === request.id}
                      >
                        {processing === request.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        onClick={() => {
                          setRejectTarget(request);
                          setRejectReason("");
                        }}
                        disabled={processing === request.id}
                        variant="destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open && !processing) setRejectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Top-Up Request</DialogTitle>
            <DialogDescription>
              Add a clear reason so the request owner knows what to fix.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Rejection reason</Label>
            <Input
              id="rejectReason"
              placeholder="Payment proof is unreadable"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={!!processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmReject()}
              disabled={!rejectReason.trim() || !!processing}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!proofTarget} onOpenChange={() => setProofTarget(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
            <DialogDescription>
              Submitted by {proofTarget?.user.name}
            </DialogDescription>
          </DialogHeader>
          {proofTarget?.proofImageUrl && (
            <div className="overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofTarget.proofImageUrl}
                alt="Payment proof"
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          )}
          {proofTarget?.proofImageUrl && (
            <DialogFooter>
              <Button variant="outline" asChild>
                <a
                  href={proofTarget.proofImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Original
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
