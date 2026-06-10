'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminTopupRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/topup-requests?status=${filter}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/topup/${id}/approve`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Approved! ${data.creditAmount} credits added.`);
        fetchRequests();
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve request');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/topup/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reason }),
      });

      if (res.ok) {
        toast.success('Request rejected');
        fetchRequests();
      } else {
        toast.error('Failed to reject');
      }
    } catch (error) {
      toast.error('Failed to reject request');
    } finally {
      setProcessing(null);
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'default',
      approved: 'success',
      rejected: 'destructive',
      expired: 'secondary',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Top-Up Requests</h1>
        <p className="text-muted-foreground mt-2">Manage QRIS top-up approvals</p>
      </div>

      <div className="flex gap-2 mb-6">
        {['pending', 'approved', 'rejected', 'expired', 'all'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No requests found
            </CardContent>
          </Card>
        ) : (
          requests.map((req) => (
            <Card key={req.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {req.user.name} ({req.user.email})
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Current balance: {req.user.creditBalance} credits
                    </p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium">Amount</p>
                    <p className="text-lg">Rp {req.amountIdr.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Credits</p>
                    <p className="text-lg">{req.creditAmount} credits</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Submitted</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Payment Method</p>
                    <p className="text-sm">{req.paymentMethod.toUpperCase()}</p>
                  </div>
                </div>

                {req.proofImageUrl && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Payment Proof</p>
                    <a
                      href={req.proofImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Image
                    </a>
                  </div>
                )}

                {req.notes && (
                  <div className="mb-4">
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{req.notes}</p>
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(req.id)}
                      disabled={processing === req.id}
                      className="flex-1"
                    >
                      {processing === req.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(req.id)}
                      disabled={processing === req.id}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
