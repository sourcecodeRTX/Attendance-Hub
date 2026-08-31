import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/types/sync';

describe('Phase 19 Frontend UX & Polish Utilities', () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  describe('Sync Queue item reset for retry', () => {
    it('resets retryCount, claimedAt, and nextAttemptAt for a dead-lettered item', async () => {
      const failedItem: SyncQueueItem = {
        id: 101,
        universityId: 'uni-1',
        ownerId: 'user-1',
        type: 'create',
        collection: 'students',
        docId: 'stu-999',
        data: { full_name: 'Test Student' },
        createdAt: new Date().toISOString(),
        retryCount: 5,
        claimedAt: '2026-08-31T10:00:00Z',
        nextAttemptAt: '2026-08-31T10:10:00Z',
      };

      await db.syncQueue.add(failedItem);
      const inserted = await db.syncQueue.get(101);
      expect(inserted?.retryCount).toBe(5);

      // Simulates the per-item retry action on /sync page
      await db.syncQueue.update(101, {
        retryCount: 0,
        claimedAt: undefined,
        nextAttemptAt: undefined,
      });

      const updated = await db.syncQueue.get(101);
      expect(updated?.retryCount).toBe(0);
      expect(updated?.claimedAt).toBeUndefined();
      expect(updated?.nextAttemptAt).toBeUndefined();
    });

    it('allows deleting a specific queue item without wiping entire queue', async () => {
      await db.syncQueue.bulkAdd([
        {
          id: 1,
          universityId: 'uni-1',
          ownerId: 'user-1',
          type: 'create',
          collection: 'students',
          docId: 'stu-1',
          data: {},
          createdAt: new Date().toISOString(),
          retryCount: 5,
        },
        {
          id: 2,
          universityId: 'uni-1',
          ownerId: 'user-1',
          type: 'create',
          collection: 'attendance_sessions',
          docId: 'att-1',
          data: {},
          createdAt: new Date().toISOString(),
          retryCount: 5,
        },
      ]);

      expect(await db.syncQueue.count()).toBe(2);

      await db.syncQueue.delete(1);

      expect(await db.syncQueue.count()).toBe(1);
      const remaining = await db.syncQueue.get(2);
      expect(remaining?.docId).toBe('att-1');
    });
  });

  describe('CSV Ingestion: Pre-check Section Duplicates', () => {
    it('identifies imported roll numbers that already exist in the target section', () => {
      const existingSectionStudents = [
        { rollNumber: 'CS101', fullName: 'Alice' },
        { rollNumber: 'CS102', fullName: 'Bob' },
        { rollNumber: 'CS103', fullName: 'Charlie' },
      ];

      const csvData = [
        { rollNumber: 'CS102', fullName: 'Bob Updated' },
        { rollNumber: 'cs103', fullName: 'Charlie Lower' },
        { rollNumber: 'CS104', fullName: 'David' },
        { rollNumber: 'CS105', fullName: 'Eve' },
      ];

      const existingRollSet = new Set(
        existingSectionStudents.map((s) => s.rollNumber.trim().toUpperCase())
      );

      const duplicateMatches = csvData.filter((row) =>
        existingRollSet.has(row.rollNumber.trim().toUpperCase())
      );

      expect(duplicateMatches.length).toBe(2);
      expect(duplicateMatches.map((d) => d.rollNumber)).toEqual(['CS102', 'cs103']);
    });
  });

  describe('Super Admin Section Scoping on /students', () => {
    it('includes all sections across all departments for super_admin role', () => {
      const allSections = [
        { id: 'sec-1', name: 'CS-A', departmentId: 'dept-1' },
        { id: 'sec-2', name: 'CS-B', departmentId: 'dept-1' },
        { id: 'sec-3', name: 'EE-A', departmentId: 'dept-2' },
      ];

      const userSuperAdmin = { role: 'super_admin', departmentId: 'dept-1' };
      const userAdmin = { role: 'admin', departmentId: 'dept-1' };

      // Super Admin: all sections regardless of profile departmentId
      const superAdminSectionIds =
        userSuperAdmin.role === 'super_admin'
          ? allSections.map((s) => s.id)
          : allSections.filter((s) => s.departmentId === userSuperAdmin.departmentId).map((s) => s.id);

      expect(superAdminSectionIds).toEqual(['sec-1', 'sec-2', 'sec-3']);

      // Admin: department-scoped sections only
      const adminSectionIds =
        userAdmin.role === 'super_admin'
          ? allSections.map((s) => s.id)
          : allSections.filter((s) => s.departmentId === userAdmin.departmentId).map((s) => s.id);

      expect(adminSectionIds).toEqual(['sec-1', 'sec-2']);
    });
  });
});
