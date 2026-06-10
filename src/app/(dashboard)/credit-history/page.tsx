'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditHistoryPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/credit/transactions?type=${filter}&limit=50`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  const getTypeColor = (type: string) => {
    const colors: any = {
      topup_qris: 'bg-green-100 text-green-800',
      topup_stripe: 'bg-green-100 text-green-800',
      deduct_screening: 'bg-red-100 text-red-800',
      daily_quota: 'bg-blue-100 text-blue-800',
      refund: 'bg-yellow-100 text-yellow-800',
      admin_adjustment: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Transaction History</h1>
        <p className="text-muted-foreground mt-2">View all credit transactions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={getTypeColor(tx.type)}>
                        {tx.type.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{tx.description}</p>
                    {tx.amountIdr && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Rp {tx.amountIdr.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        tx.creditDelta > 0 ? 'text-green-600' : tx.creditDelta < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}
                    >
                      {tx.creditDelta > 0 && '+'}
                      {tx.creditDelta}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance: {tx.balanceAfter}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
