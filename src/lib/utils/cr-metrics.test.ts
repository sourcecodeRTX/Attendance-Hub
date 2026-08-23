import { describe, expect, it } from 'vitest';
import { computeCRSectionStats } from '@/lib/utils/cr-metrics';
import type { AttendanceSession, Student } from '@/lib/types';

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-1',
    rollNumber: 'R001',
    fullName: 'Test Student',
    isActive: true,
    ...overrides,
  } as Student;
}

function makeSession(
  records: Array<{ studentId: string; isPresent: boolean; isDutyLeave?: boolean }>,
): AttendanceSession {
  return { records } as unknown as AttendanceSession;
}

describe('computeCRSectionStats', () => {
  it('counts a student with zero recorded sessions as 0%, not a fabricated 100%', () => {
    const students = [makeStudent()];
    const result = computeCRSectionStats(students, [], 75);

    expect(result.belowThreshold).toHaveLength(1);
    expect(result.belowThreshold[0].percentage).toBe(0);
  });

  it('keeps the never-marked student visible in below-threshold even when others pass', () => {
    const marked = { ...makeStudent(), id: 'stu-2', rollNumber: 'R002' };
    const neverMarked = makeStudent();
    const sessions = [
      makeSession([
        { studentId: 'stu-2', isPresent: true },
        { studentId: 'stu-2', isPresent: true },
        { studentId: 'stu-2', isPresent: true },
      ]),
    ];

    const result = computeCRSectionStats([marked, neverMarked], sessions, 75);

    expect(result.belowThreshold.map((s) => s.rollNumber)).toEqual(['R001']);
    expect(result.belowThreshold[0].percentage).toBe(0);
  });

  it('reports total students as exactly the active count (no double counting)', () => {
    const students = [
      makeStudent(),
      { ...makeStudent(), id: 'stu-2', rollNumber: 'R002' },
      { ...makeStudent(), id: 'stu-3', rollNumber: 'R003' },
    ];

    const result = computeCRSectionStats(students, [], 75);

    expect(result.activeStudentCount).toBe(3);
    expect(result.belowThreshold).toHaveLength(3);
  });

  it('excludes duty leave from absences like every other calculator', () => {
    const sessions = [
      makeSession([{ studentId: 'stu-1', isPresent: false, isDutyLeave: true }]),
    ];

    const result = computeCRSectionStats([makeStudent()], sessions, 75);

    expect(result.belowThreshold).toHaveLength(0);
  });

  it('sorts below-threshold students by ascending percentage', () => {
    const a = { ...makeStudent(), id: 'a', rollNumber: 'A' };
    const b = { ...makeStudent(), id: 'b', rollNumber: 'B' };
    const c = { ...makeStudent(), id: 'c', rollNumber: 'C' };
    // One record per student per session (matches real attendance shape).
    const sessions = [
      makeSession([
        { studentId: 'a', isPresent: true },
        { studentId: 'b', isPresent: false },
        { studentId: 'c', isPresent: true },
      ]),
      makeSession([
        { studentId: 'a', isPresent: false },
        { studentId: 'c', isPresent: false },
      ]),
      makeSession([{ studentId: 'c', isPresent: true }]),
    ];

    const result = computeCRSectionStats([a, b, c], sessions, 75);

    expect(result.belowThreshold.map((s) => s.rollNumber)).toEqual(['B', 'A', 'C']);
    expect(result.belowThreshold.map((s) => s.percentage)).toEqual([0, 50, 67]);
  });
});
