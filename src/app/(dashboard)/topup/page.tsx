"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, QrCode } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CreditBalance {
  creditBalance: number;
  dailyQuotaRemaining: number;
}

const BUNDLES = [
  { amountIdr: 10000, credits: 20, bonus: "0%", label: "Starter" },
  { amountIdr: 50000, credits: 110, bonus: "+10%", label: "Basic", popular: true },
  { amountIdr: 150000, credits: 350, bonus: "+17%", label: "Pro" },
  { amountIdr: 500000, credits: 1250, bonus: "+25%", label: "Enterprise" },
];

export default function TopupPage() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [proofImage, setProofImage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchBalance() {
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
    }
    void fetchBalance();
  }, []);

  async function handleSubmit() {
    if (!selectedBundle || !proofImage) {
      toast.error("Please select a bundle and provide payment proof URL");
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
          proofImageUrl: proofImage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit top-up request");
      }

      toast.success("Top-up request submitted. You will be notified once approved.");
      setSelectedBundle(null);
      setProofImage("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request"
      );
    } finally {
      setSubmitting(false);
    }
  }

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
                    onClick={() => setSelectedBundle(bundle.amountIdr)}
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
                <CardTitle>Payment Instructions</CardTitle>
                <CardDescription>
                  Select a bundle, complete payment, then submit proof URL.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed bg-muted/40">
                  <div className="text-center">
                    <QrCode className="mx-auto h-14 w-14 text-primary" />
                    <p className="mt-3 text-sm font-medium">QRIS Placeholder</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Replace with your QRIS image
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-md border p-4">
                    <p className="text-sm font-medium">
                      1. Pay selected amount
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedBundle
                        ? `Transfer Rp ${selectedBundle.toLocaleString("id-ID")} via QRIS.`
                        : "Choose a bundle above to see the payment amount."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="proofImage">
                      2. Payment proof screenshot URL
                    </label>
                    <Input
                      id="proofImage"
                      type="url"
                      placeholder="https://example.com/proof.jpg"
                      value={proofImage}
                      onChange={(e) => setProofImage(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !proofImage || !selectedBundle}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Submit Top-Up Request
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
