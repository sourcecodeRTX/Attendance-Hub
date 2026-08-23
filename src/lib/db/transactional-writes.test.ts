import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db/index';
import { createStudent, softDeleteStudent, updateStudent } from '@/lib/db/students';
import { createAttendanceSession } from '@/lib/db/attendance';
import type { AttendanceMarker, AttendanceSession, Student } from '@/lib/types';

const marker: AttendanceMarker = {
  uid: 'user-1',
  name: 'Teacher One',
  role: 'primary_teacher',
  markedAt: '2026-08-23T10:00:00.000Z',
};

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-1',
    universityId: 'uni-1',
    departmentId: 'dept-1',
    branchId: 'br-1',
    specialisationId: null,
    sectionId: 'sec-1',
    rollNumber: '001',
    fullName: 'Student One',
    isActive: true,
    uploadedAt: '2026-08-23T09:00:00.000Z',
    uploadedBy: 'user-1',
    ...overrides,
  };
}

function makeSession(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: 'sess-1',
    universityId: 'uni-1',
    departmentId: 'dept-1',
    sectionId: 'sec-1',
    subjectId: 'subj-1',
    date: '2026-08-23',
    periodNumber: 1,
    periodLabel: null,
    records: [],
    lockedByTeacher: false,
    isArchived: false,
    createdBy: marker,
    lastModifiedBy: marker,
    createdAt: '2026-08-23T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('F-015 — local write + sync-queue enqueue commit atomically', () => {
  it('createStudent rolls back the student row when the queue enqueue fails', async () => {
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('enqueue failed'));

    await expect(createStudent(makeStudent(), 'user-1')).rejects.toThrow('enqueue failed');

    expect(await db.students.get('stu-1')).toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('createAttendanceSession rolls back the session row when the queue enqueue fails', async () => {
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('enqueue failed'));

    await expect(createAttendanceSession(makeSession(), 'user-1')).rejects.toThrow('enqueue failed');

    expect(await db.attendanceSessions.get('sess-1')).toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('updateStudent rolls back when the queue enqueue fails', async () => {
    await db.students.put(makeStudent());
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('enqueue failed'));

    const edited = { ...makeStudent(), fullName: 'Renamed' };
    await expect(updateStudent(edited, 'user-1')).rejects.toThrow('enqueue failed');

    const stored = await db.students.get('stu-1');
    expect(stored?.fullName).toBe('Student One');
  });

  it('happy-path writes still persist both the row and exactly one queue item', async () => {
    await createStudent(makeStudent(), 'user-1');
    expect(await db.students.get('stu-1')).toBeDefined();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('softDeleteStudent on a missing student is a clean no-op with no queue item', async () => {
    await expect(softDeleteStudent('missing', 'uni-1', 'user-1')).resolves.toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
  });
});
