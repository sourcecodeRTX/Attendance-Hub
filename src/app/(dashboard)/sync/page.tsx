'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  processSyncQueue,
  pullFromCloud,
} from '@/lib/db/sync';
import { db } from '@/lib/db/index';
import type { SyncQueueItem } from '@/lib/types/sync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  RefreshCw,
  CloudDownload,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export default function SyncPage() {
  const { user, university } = useAuthStore();

  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await db.syncQueue.orderBy('createdAt').toArray();
      setQueueItems(items);
    } catch (_err) {
      toast.error('Failed to load sync queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingCount = queueItems.filter((i) => i.retryCount < 5).length;
  const failedCount = queueItems.filter((i) => i.retryCount >= 5).length;
  const syncedLabel = queueItems.length === 0 ? 'All synced' : `${queueItems.length} in queue`;

  async function handleSync() {
    setSyncing(true);
    try {
      await processSyncQueue();
      toast.success('Sync completed');
      loadData();
    } catch (_err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handlePull() {
    if (!university) return;
    setPulling(true);
    try {
      await pullFromCloud(university.id);
      toast.success('Data pulled from cloud');
      loadData();
    } catch (_err) {
      toast.error('Pull failed');
    } finally {
      setPulling(false);
    }
  }

  async function handleClearFailed() {
    setClearing(true);
    try {
      const failedItems = queueItems.filter((i) => i.retryCount >= 5);
      for (const item of failedItems) {
        if (item.id !== undefined) {
          await db.syncQueue.delete(item.id);
        }
      }
      toast.success(`Cleared ${failedItems.length} failed items`);
      setClearConfirmOpen(false);
      loadData();
    } catch (_err) {
      toast.error('Failed to clear queue');
    } finally {
      setClearing(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Sync</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePull}
            disabled={pulling}
          >
            {pulling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudDownload className="size-4" />
            )}
            Pull from Cloud
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium">{syncedLabel}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-sm font-medium">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="size-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-sm font-medium">{failedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Queue Details</h2>
          {failedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Clear Failed ({failedCount})
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : queueItems.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 size-10" />
            <p>Sync queue is empty. Everything is up to date.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Doc ID</TableHead>
                <TableHead>Retry Count</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueItems.map((item) => (
                <TableRow key={item.id ?? item.docId}>
                  <TableCell className="font-mono text-xs">
                    {item.collection}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.type === 'create'
                          ? 'default'
                          : item.type === 'bulk_create'
                          ? 'secondary'
                          : item.type === 'update'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs">
                    {item.docId}
                  </TableCell>
                  <TableCell>{item.retryCount}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(item.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {item.retryCount >= 5 ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Clear Failed Confirmation Dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear Failed Items</DialogTitle>
            <DialogDescription>
              This will permanently remove {failedCount} failed sync item
              {failedCount !== 1 ? 's' : ''} from the queue. These changes will
              not be synced to the cloud.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={handleClearFailed}
              disabled={clearing}
            >
              {clearing && <Loader2 className="size-4 animate-spin" />}
              Clear Failed Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
