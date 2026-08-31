import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  shouldFail: false,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: async () =>
          h.shouldFail
            ? { data: null, error: { message: 'Network unreachable' } }
            : { data: [], error: null },
      }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
  },
}));

import { db } from '@/lib/db/index';
import { getDepartments, deleteSection } from '@/lib/db/university';
import { toast } from 'sonner';
import type { Department } from '@/lib/types';

function makeDept(overrides: Partial<Department> = {}): Department {
  return {
    id: 'dept-1',
    universityId: 'uni-1',
    name: 'Computer Science',
    code: 'CS',
    adminId: 'admin-1',
    isActive: true,
    createdAt: '2026-08-22T09:00:00.000Z',
    createdBy: 'user-1',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  h.shouldFail = false;
  vi.mocked(toast.warning).mockClear();
});

describe('getDepartments stale-cache honesty (F-024)', () => {
  it('returns fresh cloud rows and stays silent on success', async () => {
    const cached = await getDepartments('uni-1');
    expect(cached).toEqual([]);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('falls back to the local cache on fetch failure AND warns about staleness', async () => {
    const dept = makeDept();
    await db.departments.put(dept);

    h.shouldFail = true;
    const result = await getDepartments('uni-1');

    expect(result).toEqual([dept]);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(toast.warning).mock.calls[0][0])).toMatch(/saved/i);
  });
});

describe('deleteSection cascading deletion and sync queue enqueue (F-013)', () => {
  it('deletes section, userSections, userSubjects, attendanceSessions, subjectSections, cachedAnalytics and enqueues sync item', async () => {
    await db.sections.put({
      id: 'sec-1',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      branchId: 'br-1',
      specialisationId: null,
      name: 'Section A',
      primaryTeacherId: 'tch-1',
      isActive: true,
      isArchived: false,
      createdAt: '2026-08-22T09:00:00.000Z',
      createdBy: 'user-1',
    });

    await db.userSections.put({
      id: 'us-1',
      universityId: 'uni-1',
      userId: 'tch-1',
      sectionId: 'sec-1',
      userRole: 'primary_teacher',
      assignedAt: '2026-08-22T09:00:00.000Z',
      assignedBy: 'user-1',
    });

    await db.userSubjects.put({
      id: 'usub-1',
      universityId: 'uni-1',
      userId: 'tch-1',
      subjectId: 'sub-1',
      sectionId: 'sec-1',
      assignedAt: '2026-08-22T09:00:00.000Z',
      assignedBy: 'user-1',
    });

    await db.attendanceSessions.put({
      id: 'sess-1',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      sectionId: 'sec-1',
      subjectId: 'sub-1',
      date: '2026-08-22',
      periodNumber: 1,
      periodLabel: null,
      records: [],
      lockedByTeacher: false,
      isArchived: false,
      createdBy: { uid: 'tch-1', name: 'T', role: 'primary_teacher', markedAt: '2026-08-22T10:00:00.000Z' },
      lastModifiedBy: { uid: 'tch-1', name: 'T', role: 'primary_teacher', markedAt: '2026-08-22T10:00:00.000Z' },
      createdAt: '2026-08-22T09:00:00.000Z',
      revision: 1,
    });

    await db.cachedAnalytics.put({
      id: 'section_sec-1',
      universityId: 'uni-1',
      sectionId: 'sec-1',
      data: [],
      computedAt: new Date().toISOString(),
    });

    await deleteSection('sec-1', 'uni-1', 'user-1');

    expect(await db.sections.get('sec-1')).toBeUndefined();
    expect(await db.userSections.where('sectionId').equals('sec-1').count()).toBe(0);
    expect(await db.userSubjects.where('sectionId').equals('sec-1').count()).toBe(0);
    expect(await db.attendanceSessions.where('sectionId').equals('sec-1').count()).toBe(0);
    expect(await db.cachedAnalytics.where('sectionId').equals('sec-1').count()).toBe(0);

    const queueItems = await db.syncQueue.toArray();
    const sectionDelete = queueItems.find((q) => q.collection === 'sections' && q.docId === 'sec-1');
    expect(sectionDelete).toBeDefined();
    expect(sectionDelete?.type).toBe('delete');
    expect(sectionDelete?.ownerId).toBe('user-1');
  });

  it('deletes orphan subjects and enqueues subject delete items when no other section uses the subject', async () => {
    await db.sections.put({
      id: 'sec-1',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      branchId: 'br-1',
      specialisationId: null,
      name: 'Section A',
      primaryTeacherId: 'tch-1',
      isActive: true,
      isArchived: false,
      createdAt: '2026-08-22T09:00:00.000Z',
      createdBy: 'user-1',
    });

    await db.subjects.put({
      id: 'sub-orphan',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      name: 'Orphan Subject',
      code: 'ORPH101',
      createdAt: '2026-08-22T09:00:00.000Z',
      createdBy: 'user-1',
    });

    await db.subjectSections.put({
      id: 'ss-orphan',
      subjectId: 'sub-orphan',
      sectionId: 'sec-1',
      createdAt: '2026-08-22T09:00:00.000Z',
      createdBy: 'user-1',
    });

    await deleteSection('sec-1', 'uni-1', 'user-1');

    expect(await db.subjects.get('sub-orphan')).toBeUndefined();
    expect(await db.subjectSections.get('ss-orphan')).toBeUndefined();

    const queueItems = await db.syncQueue.toArray();
    const subjectDelete = queueItems.find((q) => q.collection === 'subjects' && q.docId === 'sub-orphan');
    expect(subjectDelete).toBeDefined();
    expect(subjectDelete?.type).toBe('delete');
  });

  it('preserves shared subjects linked to remaining sections', async () => {
    await db.sections.put({
      id: 'sec-1',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      branchId: 'br-1',
      specialisationId: null,
      name: 'Section A',
      primaryTeacherId: 'tch-1',
      isActive: true,
      isArchived: false,
      createdAt: '2026-08-22T09:00:00.000Z',
      createdBy: 'user-1',
    });

    await db.subjects.put({
      id: 'sub-shared',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      name: 'Shared Subject',
      code: 'SHR101',
      createdAt: '2026-08-22T09:00:00.000Z',
      createdBy: 'user-1',
    });

    await db.subjectSections.bulkPut([
      {
        id: 'ss-sec1',
        subjectId: 'sub-shared',
        sectionId: 'sec-1',
        createdAt: '2026-08-22T09:00:00.000Z',
        createdBy: 'user-1',
      },
      {
        id: 'ss-sec2',
        subjectId: 'sub-shared',
        sectionId: 'sec-2',
        createdAt: '2026-08-22T09:00:00.000Z',
        createdBy: 'user-1',
      },
    ]);

    await deleteSection('sec-1', 'uni-1', 'user-1');

    // Subject must still exist locally because sec-2 still uses it!
    expect(await db.subjects.get('sub-shared')).toBeDefined();
    expect(await db.subjectSections.get('ss-sec1')).toBeUndefined();
    expect(await db.subjectSections.get('ss-sec2')).toBeDefined();

    const queueItems = await db.syncQueue.toArray();
    const subjectDelete = queueItems.find((q) => q.collection === 'subjects' && q.docId === 'sub-shared');
    expect(subjectDelete).toBeUndefined();
  });
});
