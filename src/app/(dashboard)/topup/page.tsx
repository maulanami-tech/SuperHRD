"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Loader2,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
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
  {
    amountIdr: 10000,
    credits: 20,
    bonus: "0%",
    label: "Starter",
    description: "Light screening needs",
    icon: Zap,
  },
  {
    amountIdr: 50000,
    credits: 110,
    bonus: "+10%",
    label: "Basic",
    description: "Best for weekly reviews",
    popular: true,
    icon: Sparkles,
  },
  {
    amountIdr: 150000,
    credits: 350,
    bonus: "+17%",
    label: "Pro",
    description: "For active hiring teams",
    icon: Sparkles,
  },
  {
    amountIdr: 500000,
    credits: 1250,
    bonus: "+25%",
    label: "Enterprise",
    description: "Highest credit efficiency",
    icon: Sparkles,
  },
];

function formatIdr(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function getPaymentStatusCopy(payment: PaymentLinkTopup | null) {
  if (!payment) {
    return {
      title: "No active payment link",
      description: "Choose a bundle, then create a Midtrans Payment Link.",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      icon: ReceiptText,
    };
  }

  if (payment.status === "approved") {
    return {
      title: "Payment successful",
      description: "Credits have been added to your account.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
    };
  }

  if (payment.status === "expired") {
    return {
      title: "Payment expired",
      description: "Create a new payment link to continue.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      icon: Clock3,
    };
  }

  if (payment.status === "rejected") {
    return {
      title: "Payment failed",
      description: "The payment was rejected by the provider.",
      className: "border-red-200 bg-red-50 text-red-800",
      icon: ReceiptText,
    };
  }

  return {
    title: "Waiting for payment",
    description: "Open the payment link, complete checkout, then status will sync automatically.",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: Clock3,
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
  const StatusIcon = statusCopy.icon;

  const selectedBundleInfo = useMemo(
    () => BUNDLES.find((bundle) => bundle.amountIdr === selectedBundle) ?? null,
    [selectedBundle]
  );

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching pattern in mount effect
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
        title="Credit wallet"
        description="Top up paid credits for AI screening"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Top Up" }]}
      >
        <Button asChild variant="outline" size="sm" className="hidden border-slate-200 bg-white hover:bg-slate-50 sm:inline-flex">
          <Link href="/credit-history">
            <ReceiptText className="mr-2 h-4 w-4" />
            Credit history
          </Link>
        </Button>
      </Header>

      <main className="min-w-0 flex-1 space-y-5 overflow-x-hidden bg-slate-50/70 p-4 pb-28 md:p-6 md:pb-8">
        {loading ? (
          <>
            <Skeleton className="h-56 rounded-lg" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-52 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-lg" />
          </>
        ) : (
          <>
            <section className="overflow-hidden rounded-lg border border-amber-100 bg-gradient-to-br from-white via-amber-50/80 to-blue-50/70 shadow-sm">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="p-5 sm:p-6 lg:p-7">
                  <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 shadow-sm">
                    <Wallet className="h-4 w-4" />
                    Credit wallet
                  </div>
                  <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    Keep screening capacity ready before the hiring queue grows.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                    Buy paid credits through Midtrans Payment Link. Your balance updates after the provider confirms settlement.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">Paid credits</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{balance?.creditBalance ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">Free quota today</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-700">{balance?.dailyQuotaRemaining ?? 0}/5</p>
                    </div>
                    <div className="col-span-2 rounded-lg border border-blue-100 bg-white p-4 shadow-sm sm:col-span-1">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">Checkout</p>
                      <p className="mt-2 text-sm font-semibold text-blue-700">Midtrans Link</p>
                    </div>
                  </div>
                </div>

                <div className="hidden border-t border-amber-100 bg-white/75 p-5 sm:block lg:border-l lg:border-t-0 lg:p-6">
                  <p className="text-sm font-semibold text-slate-950">Payment safeguards</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { icon: ShieldCheck, title: "Hosted checkout", desc: "Payment is completed on Midtrans." },
                      { icon: RefreshCw, title: "Status sync", desc: "Pending links are restored and checked." },
                      { icon: BadgeCheck, title: "Credit ledger", desc: "Every balance change is recorded." },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-600/15">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-950">{item.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {BUNDLES.map((bundle) => {
                const isSelected = selectedBundle === bundle.amountIdr;
                const BundleIcon = bundle.icon;
                const pricePerCredit = Math.round(bundle.amountIdr / bundle.credits);
                return (
                  <button
                    key={bundle.amountIdr}
                    type="button"
                    onClick={() => {
                      setSelectedBundle(bundle.amountIdr);
                      setPayment(null);
                    }}
                    className={cn(
                      "group rounded-lg border bg-white p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                      isSelected
                        ? "border-amber-400 ring-2 ring-amber-200"
                        : "border-slate-200 hover:border-amber-200 hover:bg-amber-50/30",
                      bundle.popular && !isSelected && "border-blue-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg ring-1",
                        isSelected
                          ? "bg-amber-500 text-slate-950 ring-amber-500"
                          : "bg-slate-50 text-slate-500 ring-slate-200"
                      )}>
                        <BundleIcon className="h-5 w-5" />
                      </span>
                      {bundle.popular && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/15">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-medium text-slate-500">{bundle.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950">{bundle.credits}</p>
                      <p className="text-sm text-slate-500">credits</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{formatIdr(bundle.amountIdr)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatIdr(pricePerCredit)}/credit</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-medium", bundle.bonus === "0%" ? "text-slate-400" : "text-emerald-700")}>{bundle.bonus}</p>
                        <p className="mt-1 text-xs text-slate-500">bonus</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{bundle.description}</p>
                  </button>
                );
              })}
            </section>

            <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Checkout summary</CardTitle>
                    <CardDescription>
                      Create one Midtrans Payment Link, complete payment, then sync the status here.
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="border-slate-200 sm:hidden">
                    <Link href="/credit-history">Credit history</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-blue-600/15">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Selected bundle</p>
                      <p className="text-sm text-slate-500">{selectedBundleInfo ? selectedBundleInfo.label : "No bundle selected"}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg bg-white p-4 ring-1 ring-slate-200">
                    <p className="text-sm font-medium text-slate-500">Payment amount</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {selectedBundleInfo ? formatIdr(selectedBundleInfo.amountIdr) : "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedBundleInfo ? `${selectedBundleInfo.credits} credits will be added after approval.` : "Choose a bundle above to continue."}
                    </p>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedBundle || payment?.status === "pending"}
                    className="mt-4 w-full bg-amber-500 text-slate-950 hover:bg-amber-400"
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
                </div>

                <div className="space-y-4">
                  <div className={cn("rounded-lg border p-4", statusCopy.className)}>
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 ring-1 ring-current/10">
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{statusCopy.title}</p>
                        <p className="mt-1 text-sm opacity-90">{statusCopy.description}</p>
                      </div>
                    </div>
                    {payment && (
                      <div className="mt-4 grid gap-2 rounded-lg bg-white/70 p-3 text-xs text-slate-600 ring-1 ring-current/10 sm:grid-cols-2">
                        <p><span className="font-medium text-slate-900">Order:</span> {payment.orderId}</p>
                        <p><span className="font-medium text-slate-900">Status:</span> {payment.status}</p>
                        <p><span className="font-medium text-slate-900">Provider:</span> {payment.providerStatus ?? "pending"}</p>
                        <p><span className="font-medium text-slate-900">Expires:</span> {new Date(payment.expiresAt).toLocaleString("id-ID")}</p>
                      </div>
                    )}
                  </div>

                  {redirecting && (
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-medium">Payment successful</p>
                        <p className="mt-1 text-emerald-700">Credits have been added. Redirecting to dashboard...</p>
                      </div>
                    </div>
                  )}

                  {payment?.paymentUrl && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 break-all">
                      {payment.paymentUrl}
                    </div>
                  )}

                  {payment && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        variant="outline"
                        onClick={() => void handleCheckStatus()}
                        disabled={checkingStatus}
                        className="border-slate-200 bg-white hover:bg-slate-50"
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
                        <Button variant="outline" asChild className="border-slate-200 bg-white hover:bg-slate-50">
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

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-950">What happens next</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {[
                        ["1", "Create link"],
                        ["2", "Pay on Midtrans"],
                        ["3", "Credits added"],
                      ].map(([step, label]) => (
                        <div key={step} className="flex items-center gap-2 rounded-md bg-slate-50 p-2 text-sm text-slate-600">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900 ring-1 ring-slate-200">{step}</span>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}