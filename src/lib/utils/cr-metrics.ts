import type { AttendanceSession, Student } from '@/lib/types';

export interface StudentAttendanceStat {
  rollNumber: string;
  fullName: string;
  percentage: number;
}

export interface CRSectionStats {
  activeStudentCount: number;
  belowThreshold: StudentAttendanceStat[];
}

export function computeCRSectionStats(
  activeStudents: Student[],
  sessions: AttendanceSession[],
  threshold: number,
): CRSectionStats {
  const stats: StudentAttendanceStat[] = activeStudents.map((stu) => {
    let total = 0;
    let present = 0;
    for (const sess of sessions) {
      const rec = sess.records.find((r) => r.studentId === stu.id);
      if (rec) {
        total++;
        if (rec.isPresent || rec.isDutyLeave) present++;
      }
    }
    // A student with zero recorded sessions has no measurable attendance.
    // 0 matches calcAttendancePercent's empty-set convention and keeps the
    // student visible as at-risk instead of fabricating a perfect score.
    return {
      rollNumber: stu.rollNumber,
      fullName: stu.fullName,
      percentage: total === 0 ? 0 : Math.round((present / total) * 100),
    };
  });

  return {
    activeStudentCount: activeStudents.length,
    belowThreshold: stats
      .filter((s) => s.percentage < threshold)
      .sort((a, b) => a.percentage - b.percentage),
  };
}
