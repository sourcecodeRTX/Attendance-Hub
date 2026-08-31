import { db } from './index';
import { SubjectAttendanceSummary } from '@/lib/types';

export async function getSubjectAttendanceSummary(
  subjectId: string,
  studentId: string,
  threshold: number
): Promise<SubjectAttendanceSummary | null> {
  const subject = await db.subjects.get(subjectId);
  if (!subject) return null;

  const sessions = await db.attendanceSessions
    .where('subjectId')
    .equals(subjectId)
    .filter(s => !s.isArchived)
    .toArray();

  let totalSessions = 0;
  let totalPresent = 0;
  let totalDutyLeave = 0;

  for (const session of sessions) {
    const record = session.records.find(r => r.studentId === studentId);
    if (record) {
      totalSessions++;
      if (record.isPresent) totalPresent++;
      if (record.isDutyLeave) totalDutyLeave++;
    }
  }

  const percentage = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100 * 10) / 10 : 0;

  return {
    subjectId,
    subjectName: subject.name,
    totalSessions,
    totalPresent,
    totalDutyLeave,
    percentage,
    isBelowThreshold: percentage < threshold,
  };
}

export async function getSectionAnalytics(
  sectionId: string,
  universityId: string,
  threshold: number
): Promise<SubjectAttendanceSummary[]> {
  const cacheKey = `section_${sectionId}`;
  const cached = await db.cachedAnalytics.get(cacheKey);

  if (cached) {
    const cacheAge = Date.now() - new Date(cached.computedAt).getTime();
    if (cacheAge < 5 * 60 * 1000) {
      return cached.data as SubjectAttendanceSummary[];
    }
  }

  // Subjects link to sections through the subject_sections junction table
  // (migration 013 dropped subjects.section_id).
  const links = await db.subjectSections.where('sectionId').equals(sectionId).toArray();
  const subjects =
    links.length === 0
      ? []
      : await db.subjects.where('id').anyOf(links.map((l) => l.subjectId)).toArray();
  const sessions = await db.attendanceSessions
    .where('sectionId')
    .equals(sectionId)
    .filter(s => !s.isArchived)
    .toArray();

  const summaries: SubjectAttendanceSummary[] = subjects.map(subject => {
    const subjectSessions = sessions.filter(s => s.subjectId === subject.id);
    const totalSessions = subjectSessions.length;

    let totalPresent = 0;
    let totalDutyLeave = 0;

    for (const session of subjectSessions) {
      for (const record of session.records) {
        if (record.isPresent) totalPresent++;
        if (record.isDutyLeave) totalDutyLeave++;
      }
    }

    const totalRecords = subjectSessions.reduce((sum, s) => sum + s.records.length, 0);
    const percentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100 * 10) / 10 : 0;

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      totalSessions,
      totalPresent,
      totalDutyLeave,
      percentage,
      isBelowThreshold: percentage < threshold,
    };
  });

  await db.cachedAnalytics.put({
    id: cacheKey,
    universityId,
    sectionId,
    data: summaries,
    computedAt: new Date().toISOString(),
  });

  return summaries;
}
