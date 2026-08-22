import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db/index';
import {
  createAttendanceSession,
  getNextPeriodNumber,
  getSessionsBySubjectAndDate,
  updateAttendanceSession,
} from '@/lib/db/attendance';
import type { AttendanceMarker, AttendanceSession } from '@/lib/types';

const marker: AttendanceMarker = {
  uid: 'user-1',
  name: 'Teacher One',
  role: 'primary_teacher',
  markedAt: '2026-08-22T10:00:00.000Z',
};

function makeSession(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: `${overrides.subjectId ?? 'subj-1'}_${overrides.date ?? '2026-08-22'}_${
      overrides.periodNumber ?? 1
    }`,
    universityId: 'uni-1',
    departmentId: 'dept-1',
    sectionId: 'sec-1',
    subjectId: 'subj-1',
    date: '2026-08-22',
    periodNumber: 1,
    periodLabel: null,
    records: [],
    lockedByTeacher: false,
    isArchived: false,
    createdBy: marker,
    lastModifiedBy: marker,
    createdAt: '2026-08-22T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('getNextPeriodNumber', () => {
  it('returns 1 when no sessions exist for the subject+date', async () => {
    expect(await getNextPeriodNumber('subj-1', '2026-08-22')).toBe(1);
  });

  it('returns max existing period + 1', async () => {
    await db.attendanceSessions.bulkPut([
      makeSession({ periodNumber: 2 }),
      makeSession({ periodNumber: 5 }),
    ]);
    expect(await getNextPeriodNumber('subj-1', '2026-08-22')).toBe(6);
  });

  it('ignores other subjects and other dates', async () => {
    await db.attendanceSessions.bulkPut([
      makeSession({ subjectId: 'subj-other', periodNumber: 3 }),
      makeSession({ date: '2026-08-23', periodNumber: 4 }),
    ]);
    expect(await getNextPeriodNumber('subj-1', '2026-08-22')).toBe(1);
  });
});

describe('getSessionsBySubjectAndDate', () => {
  it('excludes archived sessions', async () => {
    await db.attendanceSessions.bulkPut([
      makeSession({ periodNumber: 1 }),
      makeSession({ periodNumber: 2, isArchived: true }),
    ]);
    const sessions = await getSessionsBySubjectAndDate('subj-1', '2026-08-22');
    expect(sessions.map((s) => s.periodNumber)).toEqual([1]);
  });
});

describe('createAttendanceSession (local write + sync queue enqueue)', () => {
  it('persists the session and enqueues exactly one create item with snake_case payload', async () => {
    const session = makeSession({ records: [{ studentId: 's1', rollNumber: '001', isPresent: true, isDutyLeave: false }] });

    await createAttendanceSession(session, 'user-1');

    const stored = await db.attendanceSessions.get(session.id);
    expect(stored).toBeDefined();

    const queue = await db.syncQueue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      universityId: 'uni-1',
      ownerId: 'user-1',
      type: 'create',
      collection: 'attendance_sessions',
      docId: session.id,
      retryCount: 0,
    });
    const payload = queue[0].data as Record<string, unknown>;
    expect(payload).toMatchObject({
      id: session.id,
      university_id: 'uni-1',
      section_id: 'sec-1',
      subject_id: 'subj-1',
      date: '2026-08-22',
      period_number: 1,
      records: session.records,
    });
  });
});

describe('updateAttendanceSession', () => {
  it('enqueues an update item carrying only the mutable fields', async () => {
    const session = makeSession({ lockedByTeacher: true });
    await updateAttendanceSession(session, 'user-1');

    const queue = await db.syncQueue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('update');
    expect(queue[0].data).toEqual({
      records: [],
      locked_by_teacher: true,
      last_modified_by: marker,
    });
  });
});
