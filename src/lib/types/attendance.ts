export type AttendanceMarkerRole = 'primary_teacher' | 'regular_teacher' | 'cr';

export interface AttendanceMarker {
  uid: string;
  name: string;
  role: AttendanceMarkerRole;
  markedAt: string;
}

export interface AttendanceRecord {
  studentId: string;
  rollNumber: string;
  isPresent: boolean;
  isDutyLeave: boolean;
}

export interface AttendanceSession {
  id: string;
  universityId: string;
  departmentId: string;
  sectionId: string;
  subjectId: string;
  date: string;
  periodNumber: number;
  periodLabel: string | null;
  records: AttendanceRecord[];
  lockedByTeacher: boolean;
  isArchived: boolean;
  createdBy: AttendanceMarker;
  lastModifiedBy: AttendanceMarker;
  createdAt: string;
  /**
   * Server-maintained monotonic counter (migration 022). Sync conflict
   * resolution compares this instead of device clocks. Undefined on rows
   * written locally but not yet pulled/pushed since the column existed.
   */
  revision?: number;
}

export interface SubjectAttendanceSummary {
  subjectId: string;
  subjectName: string;
  totalSessions: number;
  totalPresent: number;
  totalDutyLeave: number;
  percentage: number;
  isBelowThreshold: boolean;
}

export interface DayAttendanceSummary {
  date: string;
  sessions: {
    subjectId: string;
    subjectName: string;
    periodNumber: number;
    presentCount: number;
    dutyLeaveCount: number;
    totalStudents: number;
    percentage: number;
  }[];
  overallDayPercentage: number;
}

export interface MonthAttendanceSummary {
  month: string;
  subjectSummaries: SubjectAttendanceSummary[];
  overallMonthPercentage: number;
}

export interface CachedAnalytics {
  id: string;
  universityId: string;
  sectionId?: string;
  data: SubjectAttendanceSummary[] | MonthAttendanceSummary[];
  computedAt: string;
}
