export interface SyncQueueItem {
  id?: number;
  universityId: string;
  ownerId: string;
  type: 'create' | 'update' | 'delete' | 'bulk_create';
  collection: string;
  docId: string;
  data: unknown;
  createdAt: string;
  retryCount: number;
  /**
   * Lease timestamp set while an item is being processed by one tab, so
   * concurrent tabs do not push the same item twice. Empty string = unclaimed.
   */
  claimedAt?: string;
  /** Earliest time the item may be retried after a failure (exponential backoff). */
  nextAttemptAt?: string;
}
