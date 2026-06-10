'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BUNDLES = [
  { amountIdr: 10000, credits: 20, bonus: '0%', label: 'Starter' },
  { amountIdr: 50000, credits: 110, bonus: '+10%', label: 'Basic', popular: true },
  { amountIdr: 150000, credits: 350, bonus: '+17%', label: 'Pro' },
  { amountIdr: 500000, credits: 1250, bonus: '+25%', label: 'Enterprise' },
];

export default function TopupPage() {
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<number | null>(null);
  const [proofImage, setProofImage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, []);

  async function fetchBalance() {
    try {
      const res = await fetch('/api/credit/balance');
      const data = await res.json();
      setBalance(data);
    } catch (error) {
      toast.error('Failed to load balance');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedBundle || !proofImage) {
      toast.error('Please select a bundle and provide payment proof URL');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/topup/qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountIdr: selectedBundle,
          paymentMethod: 'qris',
          proofImageUrl: proofImage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Top-up request submitted! You will be notified once approved.');
        setSelectedBundle(null);
        setProofImage('');
      } else {
        toast.error(data.error || 'Failed to submit top-up request');
      }
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Top Up Credits</h1>
        <p className="text-muted-foreground mt-2">
          Current balance: <span className="font-semibold">{balance?.creditBalance || 0} credits</span>
          {' | '}
          Free quota: <span className="font-semibold">{balance?.dailyQuotaRemaining || 0}/5 today</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {BUNDLES.map((bundle) => (
          <Card
            key={bundle.amountIdr}
            className={`cursor-pointer transition-all ${
              selectedBundle === bundle.amountIdr
                ? 'border-primary ring-2 ring-primary'
                : 'hover:border-primary'
            } ${bundle.popular ? 'border-blue-500' : ''}`}
            onClick={() => setSelectedBundle(bundle.amountIdr)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {bundle.label}
                {bundle.popular && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                    Popular
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Rp {bundle.amountIdr.toLocaleString('id-ID')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bundle.credits}</div>
              <div className="text-sm text-muted-foreground">credits</div>
              {bundle.bonus !== '0%' && (
                <div className="text-sm text-green-600 mt-2">{bundle.bonus} bonus</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                Rp {Math.round(bundle.amountIdr / bundle.credits)}/credit
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedBundle && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Instructions</CardTitle>
            <CardDescription>
              Complete payment and upload proof to submit request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">1. Scan QRIS code and pay Rp {selectedBundle.toLocaleString('id-ID')}</p>
              <p className="text-sm text-muted-foreground">(QRIS code will be displayed here)</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">2. Upload payment proof screenshot URL</p>
              <input
                type="text"
                placeholder="https://example.com/proof.jpg"
                value={proofImage}
                onChange={(e) => setProofImage(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !proofImage}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Top-Up Request'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
