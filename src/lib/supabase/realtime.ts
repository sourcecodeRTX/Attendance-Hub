import { createClient } from './client';
import type { AttendanceSession, Student, Subject } from '@/lib/types';

// Realtime callbacks coalesce bursts of row events into a single local
// re-read after this quiet period (F-019). Row application itself is
// immediate and unconditional per event.
export const REALTIME_REFRESH_DEBOUNCE_MS = 300;

type RealtimeCallback<T> = (payload: { eventType: string; new: T; old: T }) => void;

export function subscribeToAttendanceSessions(
  sectionId: string,
  callback: RealtimeCallback<AttendanceSession>
) {
  const supabase = createClient();
  return supabase
    .channel(`attendance_sessions:section_id=${sectionId}`)
    .on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'attendance_sessions',
        filter: `section_id=eq.${sectionId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToStudents(
  sectionId: string,
  callback: RealtimeCallback<Student>
) {
  const supabase = createClient();
  return supabase
    .channel(`students:section_id=${sectionId}`)
    .on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'students',
        filter: `section_id=eq.${sectionId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToSubjects(
  sectionId: string,
  callback: RealtimeCallback<Subject>
) {
  const supabase = createClient();
  return supabase
    .channel(`subjects:section_id=${sectionId}`)
    .on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'subjects',
        filter: `section_id=eq.${sectionId}`,
      },
      callback
    )
    .subscribe();
}
