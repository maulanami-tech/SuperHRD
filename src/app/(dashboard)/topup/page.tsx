"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, QrCode, RefreshCw } from "lucide-react";
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

interface PaymentLinkTopup {
  topupRequestId: string;
  orderId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  providerStatus: string | null;
  qrCodeUrl: string | null;
  qrString: string | null;
  paymentUrl: string | null;
  expiresAt: string;
}

interface TopupRequest {
  id: string;
  status: PaymentLinkTopup["status"];
  providerStatus: string | null;
  providerOrderId?: string | null;
  qrCodeUrl?: string | null;
  expiresAt?: string;
}

const BUNDLES = [
  { amountIdr: 10000, credits: 20, bonus: "0%", label: "Starter" },
  { amountIdr: 50000, credits: 110, bonus: "+10%", label: "Basic", popular: true },
  { amountIdr: 150000, credits: 350, bonus: "+17%", label: "Pro" },
  { amountIdr: 500000, credits: 1250, bonus: "+25%", label: "Enterprise" },
];

function getPaymentStatusCopy(payment: PaymentLinkTopup | null) {
  if (!payment) {
    return {
      title: "Waiting for payment",
      description: "Create a payment link to start.",
      className: "border bg-background text-foreground",
    };
  }

  if (payment.status === "approved") {
    return {
      title: "Payment successful",
      description: "Credits have been added to your account.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (payment.status === "expired") {
    return {
      title: "Payment expired",
      description: "Create a new payment link to continue.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (payment.status === "rejected") {
    return {
      title: "Payment failed",
      description: "The payment was rejected by the provider.",
      className: "border-red-200 bg-red-50 text-red-800",
    };
  }

  return {
    title: "Waiting for payment",
    description: "Open the payment link, complete the payment, then status will update automatically.",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  };
}

export default function TopupPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [payment, setPayment] = useState<PaymentLinkTopup | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const statusCopy = getPaymentStatusCopy(payment);

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

  const loadLatestPendingPayment = useCallback(async () => {
    try {
      const res = await fetch("/api/topup/requests?status=pending&limit=20");
      if (!res.ok) {
        return;
      }

      const data: { requests?: Array<TopupRequest & { providerOrderId?: string | null; qrCodeUrl?: string | null; expiresAt?: string }> } = await res.json();
      const current = data.requests?.find((request) => {
        if (!request.providerOrderId || !request.expiresAt) {
          return false;
        }

        return new Date(request.expiresAt).getTime() > Date.now();
      });
      if (!current?.providerOrderId || !current.expiresAt) {
        setPayment(null);
        return;
      }

      setPayment({
        topupRequestId: current.id,
        orderId: current.providerOrderId,
        status: current.status,
        providerStatus: current.providerStatus,
        qrCodeUrl: current.qrCodeUrl ?? null,
        qrString: null,
        paymentUrl: current.qrCodeUrl ?? null,
        expiresAt: current.expiresAt,
      });
    } catch {
      // keep page usable even if pending request restore fails
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchBalance(), loadLatestPendingPayment()]);
  }, [fetchBalance, loadLatestPendingPayment]);

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

      const data: PaymentLinkTopup & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create payment link");
      }

      setPayment(data);
      toast.success("Payment link created. Open it to complete the payment.");
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
        status?: PaymentLinkTopup["status"] | string;
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
        setRedirecting(true);
        window.setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      } else if (current.status === "expired") {
        toast.error("Payment expired. Please create a new payment link.");
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
                <CardTitle>Midtrans Payment Link</CardTitle>
                <CardDescription>
                  Select a bundle, create a payment link, then complete payment on the Midtrans checkout page.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-6">
                  <div className="text-center">
                    <QrCode className="mx-auto h-14 w-14 text-primary" />
                    <p className="mt-3 text-sm font-medium">Midtrans Checkout</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {payment?.paymentUrl
                        ? "Open the payment link to continue checkout on Midtrans."
                        : "Payment link appears after you create a payment."}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-md border p-4">
                    <p className="text-sm font-medium">1. Payment amount</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedBundle
                        ? `Rp ${selectedBundle.toLocaleString("id-ID")} via Midtrans Payment Link.`
                        : "Choose a bundle above to see the payment amount."}
                    </p>
                  </div>

                  {payment && (
                    <div className={cn("rounded-md p-4 text-sm", statusCopy.className)}>
                      <p className="font-medium">{statusCopy.title}</p>
                      <p className="mt-1">{statusCopy.description}</p>
                      <div className="mt-3 grid gap-1 text-muted-foreground">
                        <p>Order: {payment.orderId}</p>
                        <p>Status: {payment.status}</p>
                        <p>Provider: {payment.providerStatus ?? "pending"}</p>
                        <p>
                          Expires: {new Date(payment.expiresAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  )}

                  {redirecting && (
                    <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-medium">Payment successful</p>
                        <p className="mt-1 text-emerald-700">
                          Credits have been added. Redirecting to dashboard...
                        </p>
                      </div>
                    </div>
                  )}

                  {payment?.paymentUrl && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground break-all">
                      {payment.paymentUrl}
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
                        Creating payment link...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Create Payment Link
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
                        ) : redirecting ? (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {redirecting ? "Payment Successful" : "Check Status"}
                      </Button>
                      {(payment.paymentUrl ?? payment.qrCodeUrl) && (
                        <Button variant="outline" asChild>
                          <a
                            href={payment.paymentUrl ?? payment.qrCodeUrl ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Payment Link
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
