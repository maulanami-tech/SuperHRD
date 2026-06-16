"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CreditBalance {
  creditBalance: number;
  dailyQuotaRemaining: number;
}

interface QrisPayment {
  topupRequestId: string;
  orderId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  providerStatus: string | null;
  qrCodeUrl: string | null;
  qrString: string | null;
  expiresAt: string;
}

interface TopupRequest {
  id: string;
  status: QrisPayment["status"];
  providerStatus: string | null;
}

const BUNDLES = [
  { amountIdr: 10000, credits: 20, bonus: "0%", label: "Starter" },
  { amountIdr: 50000, credits: 110, bonus: "+10%", label: "Basic", popular: true },
  { amountIdr: 150000, credits: 350, bonus: "+17%", label: "Pro" },
  { amountIdr: 500000, credits: 1250, bonus: "+25%", label: "Enterprise" },
];

export default function TopupPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [payment, setPayment] = useState<QrisPayment | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/credit/balance");
      if (!res.ok) throw new Error("Failed to load balance");
      const data: CreditBalance = await res.json();
      setBalance(data);
    } catch {
      toast.error("Failed to load balance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchBalance);
  }, [fetchBalance]);

  async function handleSubmit() {
    if (!selectedBundle) {
      toast.error("Please select a bundle");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/topup/qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountIdr: selectedBundle,
          paymentMethod: "qris",
        }),
      });

      const data: QrisPayment & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create QRIS payment");
      }

      setPayment(data);
      toast.success("QRIS payment created. Credits will be added after payment succeeds.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create payment"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const handleCheckStatus = useCallback(async (silent = false) => {
    if (!payment) return;

    setCheckingStatus(true);
    try {
      const syncRes = await fetch(`/api/topup/${payment.topupRequestId}/sync`, {
        method: "POST",
      });
      const syncData: {
        error?: string;
        status?: QrisPayment["status"] | string;
      } = await syncRes.json();

      if (!syncRes.ok) {
        throw new Error(syncData.error || "Failed to sync payment status");
      }

      const res = await fetch("/api/topup/requests?status=all&limit=20");
      if (!res.ok) throw new Error("Failed to load payment status");

      const data: { requests?: TopupRequest[] } = await res.json();
      const current = data.requests?.find(
        (request) => request.id === payment.topupRequestId,
      );
      if (!current) throw new Error("Payment request not found");

      setPayment((prev) =>
        prev
          ? {
              ...prev,
              status: current.status,
              providerStatus: current.providerStatus,
            }
          : prev
      );

      if (current.status === "approved") {
        if (!silent) toast.success("Payment approved. Credits have been added.");
        await fetchBalance();
        router.push("/dashboard");
      } else if (current.status === "expired") {
        toast.error("Payment expired. Please create a new QRIS payment.");
      } else if (current.status === "rejected") {
        toast.error("Payment was rejected by provider.");
      } else {
        if (!silent) toast.info("Payment is still pending.");
      }
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Failed to check status");
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [fetchBalance, payment, router]);

  useEffect(() => {
    if (!payment || payment.status !== "pending") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void handleCheckStatus(true);
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [handleCheckStatus, payment]);

  return (
    <>
      <Header
        title="Top Up Credits"
        description={
          balance
            ? `Current balance: ${balance.creditBalance} credits | Free quota: ${balance.dailyQuotaRemaining}/5 today`
            : "Purchase credits for CV screening"
        }
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Top Up" }]}
      />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {loading ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-48 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-lg" />
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {BUNDLES.map((bundle) => {
                const isSelected = selectedBundle === bundle.amountIdr;
                return (
                  <Card
                    key={bundle.amountIdr}
                    className={cn(
                      "cursor-pointer transition-colors hover:border-primary",
                      isSelected && "border-primary ring-2 ring-primary",
                      bundle.popular && !isSelected && "border-primary/40"
                    )}
                    onClick={() => {
                      setSelectedBundle(bundle.amountIdr);
                      setPayment(null);
                    }}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3">
                        {bundle.label}
                        {bundle.popular && (
                          <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                            Popular
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Rp {bundle.amountIdr.toLocaleString("id-ID")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-semibold">{bundle.credits}</div>
                      <div className="text-sm text-muted-foreground">credits</div>
                      {bundle.bonus !== "0%" && (
                        <div className="mt-2 text-sm text-emerald-600">
                          {bundle.bonus} bonus
                        </div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">
                        Rp {Math.round(bundle.amountIdr / bundle.credits)}/credit
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>QRIS Payment</CardTitle>
                <CardDescription>
                  Select a bundle, generate a QRIS code, then pay from your wallet or mobile banking app.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {payment?.qrCodeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={payment.qrCodeUrl}
                      alt="Midtrans QRIS payment code"
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <div className="text-center">
                      <QrCode className="mx-auto h-14 w-14 text-primary" />
                      <p className="mt-3 text-sm font-medium">QRIS Midtrans</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        QR code appears after you create a payment.
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-md border p-4">
                    <p className="text-sm font-medium">1. Payment amount</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedBundle
                        ? `Rp ${selectedBundle.toLocaleString("id-ID")} via QRIS Midtrans.`
                        : "Choose a bundle above to see the payment amount."}
                    </p>
                  </div>

                  {payment && (
                    <div className="rounded-md border p-4 text-sm">
                      <p className="font-medium">2. Payment status</p>
                      <div className="mt-2 grid gap-1 text-muted-foreground">
                        <p>Order: {payment.orderId}</p>
                        <p>Status: {payment.status}</p>
                        <p>Provider: {payment.providerStatus ?? "pending"}</p>
                        <p>
                          Expires: {new Date(payment.expiresAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  )}

                  {payment?.qrString && !payment.qrCodeUrl && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground break-all">
                      {payment.qrString}
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedBundle || payment?.status === "pending"}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating QRIS...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Create QRIS Payment
                      </>
                    )}
                  </Button>

                  {payment && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleCheckStatus()}
                        disabled={checkingStatus}
                      >
                        {checkingStatus ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Check Status
                      </Button>
                      {payment.qrCodeUrl && (
                        <Button variant="outline" asChild>
                          <a
                            href={payment.qrCodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open QR
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
