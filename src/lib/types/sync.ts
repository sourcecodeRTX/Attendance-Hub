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
}
