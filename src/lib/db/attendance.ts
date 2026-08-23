import { db } from './index';
import { AttendanceSession } from '@/lib/types';

export async function getAttendanceSessions(sectionId: string): Promise<AttendanceSession[]> {
  return db.attendanceSessions.where('sectionId').equals(sectionId).toArray();
}

export async function getSessionsBySubjectAndDate(subjectId: string, date: string): Promise<AttendanceSession[]> {
  return db.attendanceSessions
    .where('[subjectId+date]')
    .equals([subjectId, date])
    .filter(s => !s.isArchived)
    .toArray();
}

export async function getSessionById(id: string): Promise<AttendanceSession | undefined> {
  return db.attendanceSessions.get(id);
}

export async function getNextPeriodNumber(subjectId: string, date: string): Promise<number> {
  const sessions = await db.attendanceSessions
    .where('[subjectId+date]')
    .equals([subjectId, date])
    .toArray();
  if (sessions.length === 0) return 1;
  return Math.max(...sessions.map(s => s.periodNumber)) + 1;
}

export async function createAttendanceSession(
  session: AttendanceSession,
  userId: string
): Promise<void> {
  // Local write and queue enqueue must commit together (F-015) — a crash
  // between them would leave a row that never syncs.
  await db.transaction('rw', [db.attendanceSessions, db.syncQueue, db.cachedAnalytics], async () => {
    await db.attendanceSessions.put(session);
    await db.syncQueue.add({
      universityId: session.universityId,
      ownerId: userId,
      type: 'create',
      collection: 'attendance_sessions',
      docId: session.id,
      data: {
        id: session.id,
        university_id: session.universityId,
        department_id: session.departmentId,
        section_id: session.sectionId,
        subject_id: session.subjectId,
        date: session.date,
        period_number: session.periodNumber,
        period_label: session.periodLabel,
        records: session.records,
        locked_by_teacher: session.lockedByTeacher,
        is_archived: session.isArchived,
        created_by: session.createdBy,
        last_modified_by: session.lastModifiedBy,
        created_at: session.createdAt,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
    await invalidateAnalyticsCache(session.sectionId);
  });
}

export async function updateAttendanceSession(
  session: AttendanceSession,
  userId: string
): Promise<void> {
  await db.transaction('rw', [db.attendanceSessions, db.syncQueue, db.cachedAnalytics], async () => {
    await db.attendanceSessions.put(session);
    await db.syncQueue.add({
      universityId: session.universityId,
      ownerId: userId,
      type: 'update',
      collection: 'attendance_sessions',
      docId: session.id,
      data: {
        records: session.records,
        locked_by_teacher: session.lockedByTeacher,
        last_modified_by: session.lastModifiedBy,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
    await invalidateAnalyticsCache(session.sectionId);
  });
}

export async function archiveSessions(sessionIds: string[], universityId: string, userId: string): Promise<void> {
  await db.transaction('rw', [db.attendanceSessions, db.syncQueue], async () => {
    for (const id of sessionIds) {
      const session = await db.attendanceSessions.get(id);
      if (!session) continue;
      session.isArchived = true;
      await db.attendanceSessions.put(session);
      await db.syncQueue.add({
        universityId,
        ownerId: userId,
        type: 'update',
        collection: 'attendance_sessions',
        docId: id,
        data: { is_archived: true },
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
    }
  });
}

async function invalidateAnalyticsCache(sectionId: string): Promise<void> {
  await db.cachedAnalytics
    .where('id')
    .startsWith(`section_${sectionId}`)
    .delete();
}
