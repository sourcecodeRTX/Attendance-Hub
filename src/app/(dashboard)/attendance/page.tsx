'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { useSound } from '@/hooks/use-sound';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  getSessionsBySubjectAndDate,
  getNextPeriodNumber,
  createAttendanceSession,
  updateAttendanceSession,
  getAttendanceSessions,
} from '@/lib/db/attendance';
import { getActiveStudents } from '@/lib/db/students';
import { getSubjects, getSubjectById } from '@/lib/db/subjects';
import { getUserSubjects, getPrimarySectionId, getSubjectTeachers } from '@/lib/db/user-sections';
import { getSections } from '@/lib/db/university';
import { logActivity } from '@/lib/db/activity';

import type {
  AttendanceSession,
  AttendanceRecord,
  AttendanceMarker,
  Subject,
  Student,
  UserSubject,
} from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

import {
  Search,
  Save,
  Plus,
  Users,
  Clock,
  Shield,
  Filter,
  Loader2,
  CalendarDays,
  BookOpen,
  Lock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { subscribeToAttendanceSessions } from '@/lib/supabase/realtime';
import { pullFromCloud } from '@/lib/db/sync';
import { useVirtualizer } from '@tanstack/react-virtual';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type StatusFilter = 'all' | 'present' | 'absent' | 'dl';

interface StudentRow {
  student: Student;
  isPresent: boolean;
  isDutyLeave: boolean;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type DropdownSubject = {
  subject: Subject;
  sectionId: string;
  sectionName: string;
  type: 'primary' | 'regular';
};

export default function AttendancePage() {
  const { user, university } = useAuthStore();
  const { sortOrder, sortDirection, setSortOrder, setSortDirection } = usePreferencesStore();
  const effectiveSortOrder = sortOrder ?? 'original';
  const { playSound } = useSound();

  useEffect(() => {
    // Keep sorting deterministic after removing direction controls from the UI.
    setSortDirection('asc');
  }, [setSortDirection]);

  // ---- data ----
  const [dropdownSubjects, setDropdownSubjects] = useState<DropdownSubject[]>([]);
  const [selectedDropdownValue, setSelectedDropdownValue] = useState<string>(''); // format: "subjectId|sectionId"
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);
  const [userSectionId, setUserSectionId] = useState<string>(''); // Used for primary teachers OR derived from selection
  const [assignedRegularTeacherId, setAssignedRegularTeacherId] = useState<string | null>(null);

  // ---- session editing ----
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [nextPeriod, setNextPeriod] = useState(1);
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(
    new Map(),
  );

  // ---- UI ----
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);

  // ---- history ----
  const [historySessions, setHistorySessions] = useState<AttendanceSession[]>(
    [],
  );
  const [viewingHistorySession, setViewingHistorySession] =
    useState<AttendanceSession | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [attendanceView, setAttendanceView] = useState<'today' | 'history'>('today');

  // ---- derived ----
  const today = getTodayUTC();
  const isTeacher =
    user?.role === 'primary_teacher' || user?.role === 'regular_teacher';
  const isCR = user?.role === 'cr';

  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return todaySessions.find((s) => s.id === activeSessionId) ?? null;
  }, [activeSessionId, todaySessions]);

  const isReadOnly = useMemo(() => {
    if (viewingHistorySession) {
      if (isCR && viewingHistorySession.lockedByTeacher) return true;
      if (viewingHistorySession.date !== today) return true;
    }

    // Restrict primary teachers from editing regular teacher subjects
    if (user?.role === 'primary_teacher') {
      if (assignedRegularTeacherId && assignedRegularTeacherId !== user.id) {
        return true;
      }
    }

    if (!activeSession) return false;
    return !!(isCR && activeSession.lockedByTeacher);
  }, [activeSession, isCR, viewingHistorySession, today, user, assignedRegularTeacherId]);

  const showMarkingUI = isNewSession || activeSessionId !== null;

  // =========================================================================
  // Data loading
  // =========================================================================

  useEffect(() => {
    if (!user || !university) return;

    let cancelled = false;

    async function loadSubjects() {
      setIsLoading(true);
      try {
        // Pull latest data from Supabase (don't let failure block local load)
        try {
          await pullFromCloud(university!.id);
        } catch (pullErr) {
          console.warn('Cloud pull failed, using local data:', pullErr);
        }

        const allSections = await getSections(university!.id);
        const sectionMap = new Map(allSections.map(s => [s.id, s.name]));
        
        let newDropdownSubjects: DropdownSubject[] = [];

        if (user!.role === 'primary_teacher' || user!.role === 'cr' || user!.role === 'regular_teacher') {
          // 1. Fetch Primary Section Subjects (if they are a primary teacher or CR)
          const primarySectionId = await getPrimarySectionId(user!.id);
          if (primarySectionId) {
            const primarySubs = await getSubjects(primarySectionId);
            const sectionName = sectionMap.get(primarySectionId) || 'Unknown Section';
            newDropdownSubjects = primarySubs.map(subject => ({
              subject,
              sectionId: primarySectionId,
              sectionName,
              type: 'primary'
            }));
          }

          // 2. Fetch Assigned Subjects (regular teacher assignments, which primary teachers can ALSO have)
          const userSubs = await getUserSubjects(user!.id);
          for (const us of userSubs) {
            // Avoid adding duplicates (e.g., if already added from primary section)
            const isDuplicate = newDropdownSubjects.some(
              ds => ds.subject.id === us.subjectId && ds.sectionId === us.sectionId
            );
            if (!isDuplicate) {
              const subject = await getSubjectById(us.subjectId);
              if (subject) {
                const sectionName = sectionMap.get(us.sectionId) || 'Unknown Section';
                newDropdownSubjects.push({
                  subject,
                  sectionId: us.sectionId,
                  sectionName,
                  type: 'regular'
                });
              }
            }
          }

          if (!cancelled) {
            setDropdownSubjects(newDropdownSubjects);
            if (newDropdownSubjects.length === 0) {
              toast.error('No subjects assigned. Please contact admin.');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
        if (!cancelled) toast.error('Failed to load subjects');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [user, university]);

  useEffect(() => {
    if (!selectedSubjectId || !userSectionId) return;
    if (!user) return;

    // Use the explicitly selected section ID
    const effectiveSectionId = userSectionId;
    
    if (!effectiveSectionId) {
      console.warn('[Attendance] No section found for subject:', selectedSubjectId);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setIsLoadingSessions(true);
      try {
        const sid = effectiveSectionId;

        const [activeStudents, sessions, nextP, allSessions, teachers] =
          await Promise.all([
            getActiveStudents(sid),
            getSessionsBySubjectAndDate(selectedSubjectId, today),
            getNextPeriodNumber(selectedSubjectId, today),
            getAttendanceSessions(sid),
            getSubjectTeachers(selectedSubjectId),
          ]);

        if (cancelled) return;

        const assignedTeacher = teachers.find(t => t.sectionId === sid);
        setAssignedRegularTeacherId(assignedTeacher?.userId ?? null);

        setStudents(activeStudents);
        setTodaySessions(sessions.sort((a, b) => a.periodNumber - b.periodNumber));
        setNextPeriod(nextP);

        const history = allSessions
          .filter(
            (s) =>
              s.subjectId === selectedSubjectId &&
              s.date !== today &&
              !s.isArchived,
          )
          .sort((a, b) => {
            const dc = b.date.localeCompare(a.date);
            return dc !== 0 ? dc : a.periodNumber - b.periodNumber;
          });
        setHistorySessions(history);

        setActiveSessionId(null);
        setIsNewSession(false);
        setRecords(new Map());
        setHasUnsavedChanges(false);
        setViewingHistorySession(null);
        setExpandedDates(new Set());
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('Failed to load attendance data');
      } finally {
        if (!cancelled) setIsLoadingSessions(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, userSectionId, user, today, refreshKey]);

  useEffect(() => {
    if (!user || !university || !selectedSubjectId || !userSectionId) return;

    const channel = subscribeToAttendanceSessions(userSectionId, async () => {
      await pullFromCloud(university.id);
      setRefreshKey((v) => v + 1);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user, university, selectedSubjectId, userSectionId]);

  // =========================================================================
  // Record helpers
  // =========================================================================

  const initializeRecords = useCallback(
    (studentList: Student[]) => {
      const m = new Map<string, AttendanceRecord>();
      for (const s of studentList) {
        m.set(s.id, {
          studentId: s.id,
          rollNumber: s.rollNumber,
          isPresent: true,
          isDutyLeave: false,
        });
      }
      setRecords(m);
    },
    [],
  );

  const loadSessionRecords = useCallback(
    (session: AttendanceSession, studentList: Student[]) => {
      const m = new Map<string, AttendanceRecord>();
      for (const r of session.records) {
        m.set(r.studentId, { ...r });
      }
      for (const s of studentList) {
        if (!m.has(s.id)) {
          m.set(s.id, {
            studentId: s.id,
            rollNumber: s.rollNumber,
            isPresent: true,
            isDutyLeave: false,
          });
        }
      }
      setRecords(m);
    },
    [],
  );

  // =========================================================================
  // Session actions
  // =========================================================================

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setIsNewSession(true);
    setViewingHistorySession(null);
    initializeRecords(students);
    setHasUnsavedChanges(false);
    setSearchQuery('');
    setStatusFilter('all');
    playSound('toggle');
  }, [students, initializeRecords, playSound]);

  const handleSelectSession = useCallback(
    (session: AttendanceSession) => {
      setActiveSessionId(session.id);
      setIsNewSession(false);
      setViewingHistorySession(null);
      loadSessionRecords(session, students);
      setHasUnsavedChanges(false);
      setSearchQuery('');
      setStatusFilter('all');
    },
    [students, loadSessionRecords],
  );

  // =========================================================================
  // Attendance marking
  // =========================================================================

  const toggleAttendance = useCallback(
    (studentId: string) => {
      if (isReadOnly) return;

      setRecords((prev) => {
        const next = new Map(prev);
        const r = next.get(studentId);
        if (!r) return prev;

        if (r.isDutyLeave) {
          next.set(studentId, { ...r, isPresent: false, isDutyLeave: false });
        } else {
          next.set(studentId, {
            ...r,
            isPresent: !r.isPresent,
            isDutyLeave: false,
          });
        }
        return next;
      });
      setHasUnsavedChanges(true);
      playSound('toggle');
    },
    [isReadOnly, playSound],
  );

  const toggleDutyLeave = useCallback(
    (studentId: string) => {
      if (isReadOnly) return;

      setRecords((prev) => {
        const next = new Map(prev);
        const r = next.get(studentId);
        if (!r) return prev;

        if (r.isDutyLeave) {
          next.set(studentId, { ...r, isPresent: true, isDutyLeave: false });
        } else {
          next.set(studentId, { ...r, isPresent: true, isDutyLeave: true });
        }
        return next;
      });
      setHasUnsavedChanges(true);
      playSound('toggle');
    },
    [isReadOnly, playSound],
  );

  const markAllPresent = useCallback(() => {
    if (isReadOnly) return;

    setRecords((prev) => {
      const next = new Map(prev);
      for (const [id, r] of next) {
        next.set(id, { ...r, isPresent: true, isDutyLeave: false });
      }
      return next;
    });
    setHasUnsavedChanges(true);
    playSound('success');
    toast.success('All students marked present');
  }, [isReadOnly, playSound]);

  // =========================================================================
  // Save
  // =========================================================================

  const performSave = useCallback(async () => {
    if (!user || !university || !selectedSubjectId || records.size === 0)
      return;

    const subject = dropdownSubjects.find((s) => s.subject.id === selectedSubjectId)?.subject;
    if (!subject) return;

    setIsSaving(true);
    try {
      const marker: AttendanceMarker = {
        uid: user.id,
        name: user.fullName,
        role: user.role as 'primary_teacher' | 'regular_teacher' | 'cr',
        markedAt: new Date().toISOString(),
      };

      const recordsArr = Array.from(records.values());
      const lockedByTeacher = isTeacher;
      const presentCount = recordsArr.filter(
        (r) => r.isPresent && !r.isDutyLeave,
      ).length;
      const absentCount = recordsArr.filter((r) => !r.isPresent).length;
      const dlCount = recordsArr.filter((r) => r.isDutyLeave).length;

      if (isNewSession) {
        const periodNumber = nextPeriod;
        const sessionId = `${selectedSubjectId}_${today}_${periodNumber}`;

        const session: AttendanceSession = {
          id: sessionId,
          universityId: university.id,
          departmentId: subject.departmentId,
          sectionId: userSectionId, // Use user's section ID
          subjectId: selectedSubjectId,
          date: today,
          periodNumber,
          periodLabel: null,
          records: recordsArr,
          lockedByTeacher,
          isArchived: false,
          createdBy: marker,
          lastModifiedBy: marker,
          createdAt: new Date().toISOString(),
        };

        await createAttendanceSession(session, user.id);

        await logActivity({
          universityId: university.id,
          departmentId: subject.departmentId,
          actionType: 'attendance_marked',
          performedByRole: user.role,
          performedByName: user.fullName,
          performedById: user.id,
          targetName: subject.name,
          details: {
            subjectCode: subject.code,
            periodNumber,
            date: today,
            presentCount,
            absentCount,
            dutyLeaveCount: dlCount,
          },
        });

        const sessions = await getSessionsBySubjectAndDate(
          selectedSubjectId,
          today,
        );
        setTodaySessions(
          sessions.sort((a, b) => a.periodNumber - b.periodNumber),
        );
        setNextPeriod(
          await getNextPeriodNumber(selectedSubjectId, today),
        );

        setActiveSessionId(sessionId);
        setIsNewSession(false);

        toast.success(`Attendance saved for Period ${periodNumber}`);
      } else if (activeSessionId) {
        const existing = todaySessions.find((s) => s.id === activeSessionId);
        if (!existing) throw new Error('Session not found');

        const updated: AttendanceSession = {
          ...existing,
          records: recordsArr,
          lockedByTeacher: existing.lockedByTeacher || lockedByTeacher,
          lastModifiedBy: marker,
        };

        await updateAttendanceSession(updated, user.id);

        await logActivity({
          universityId: university.id,
          departmentId: subject.departmentId,
          actionType: 'attendance_edited',
          performedByRole: user.role,
          performedByName: user.fullName,
          performedById: user.id,
          targetName: subject.name,
          details: {
            subjectCode: subject.code,
            periodNumber: existing.periodNumber,
            date: today,
            presentCount,
            absentCount,
            dutyLeaveCount: dlCount,
          },
        });

        const sessions = await getSessionsBySubjectAndDate(
          selectedSubjectId,
          today,
        );
        setTodaySessions(
          sessions.sort((a, b) => a.periodNumber - b.periodNumber),
        );

        toast.success(
          `Attendance updated for Period ${existing.periodNumber}`,
        );
      }

      setHasUnsavedChanges(false);
      playSound('success');
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error('Failed to save attendance');
      playSound('error');
    } finally {
      setIsSaving(false);
    }
  }, [
    user,
    university,
    selectedSubjectId,
    dropdownSubjects,
    records,
    isNewSession,
    activeSessionId,
    nextPeriod,
    today,
    isTeacher,
    todaySessions,
    userSectionId,
    playSound,
  ]);

  const handleSaveClick = useCallback(() => {
    // If editing an existing session, show confirmation dialog
    if (!isNewSession && activeSessionId) {
      setShowEditConfirmation(true);
      return;
    }
    // For new sessions, save directly
    performSave();
  }, [isNewSession, activeSessionId, performSave]);

  const handleConfirmedSave = useCallback(() => {
    setShowEditConfirmation(false);
    performSave();
  }, [performSave]);

  // =========================================================================
  // Computed display data
  // =========================================================================

  const displayStudents = useMemo((): StudentRow[] => {
    let rows: StudentRow[] = students.map((student) => {
      const r = records.get(student.id);
      return {
        student,
        isPresent: r?.isPresent ?? true,
        isDutyLeave: r?.isDutyLeave ?? false,
      };
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        ({ student }) =>
          student.fullName.toLowerCase().includes(q) ||
          student.rollNumber.toLowerCase().includes(q),
      );
    }

    if (statusFilter === 'present') {
      rows = rows.filter((r) => r.isPresent && !r.isDutyLeave);
    } else if (statusFilter === 'absent') {
      rows = rows.filter((r) => !r.isPresent);
    } else if (statusFilter === 'dl') {
      rows = rows.filter((r) => r.isDutyLeave);
    }

    if (effectiveSortOrder === 'name') {
      rows.sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
    } else if (effectiveSortOrder === 'roll_number') {
      rows.sort((a, b) => a.student.rollNumber.localeCompare(b.student.rollNumber));
    } else {
      rows.sort((a, b) => {
        const timeDiff = (a.student.uploadedAt ?? '').localeCompare(b.student.uploadedAt ?? '');
        return timeDiff !== 0
          ? timeDiff
          : a.student.rollNumber.localeCompare(b.student.rollNumber);
      });
    }

    if (sortDirection === 'desc') {
      rows.reverse();
    }

    return rows;
  }, [students, records, searchQuery, statusFilter, effectiveSortOrder, sortDirection]);

  const summary = useMemo(() => {
    const all = Array.from(records.values());
    return {
      total: all.length,
      present: all.filter((r) => r.isPresent && !r.isDutyLeave).length,
      absent: all.filter((r) => !r.isPresent).length,
      dutyLeave: all.filter((r) => r.isDutyLeave).length,
    };
  }, [records]);

  const historyByDate = useMemo(() => {
    const groups = new Map<string, AttendanceSession[]>();
    for (const s of historySessions) {
      const arr = groups.get(s.date) ?? [];
      arr.push(s);
      groups.set(s.date, arr);
    }
    return Array.from(groups.entries()).sort((a, b) =>
      b[0].localeCompare(a[0]),
    );
  }, [historySessions]);

  // =========================================================================
  // History helpers
  // =========================================================================

  const toggleDateExpanded = useCallback((date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const handleViewHistorySession = useCallback(
    (session: AttendanceSession) => {
      setViewingHistorySession(session);
      setActiveSessionId(null);
      setIsNewSession(false);

      const m = new Map<string, AttendanceRecord>();
      for (const r of session.records) {
        m.set(r.studentId, { ...r });
      }
      setRecords(m);
    },
    [],
  );

  const closeHistoryView = useCallback(() => {
    setViewingHistorySession(null);
    setRecords(new Map());
  }, []);

  // History summary for a given session
  const getSessionSummary = useCallback((session: AttendanceSession) => {
    const recs = session.records;
    return {
      total: recs.length,
      present: recs.filter((r) => r.isPresent && !r.isDutyLeave).length,
      absent: recs.filter((r) => !r.isPresent).length,
      dl: recs.filter((r) => r.isDutyLeave).length,
    };
  }, []);

  // =========================================================================
  // Guards
  // =========================================================================

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Mark Attendance</h1>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {formatDateLabel(today)} &middot; {dropdownSubjects.length} subject
            {dropdownSubjects.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      {/* Subject selector + date badge */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">
                Subject
              </label>
              <Select
                value={selectedDropdownValue}
                onValueChange={(val: string | null) => {
                  if (!val) return;
                  if (hasUnsavedChanges) {
                    const ok = window.confirm(
                      'You have unsaved changes. Switch subject anyway?',
                    );
                    if (!ok) return;
                  }
                  setSelectedDropdownValue(val);
                  const [subId, secId] = val.split('|');
                  setSelectedSubjectId(subId);
                  setUserSectionId(secId);
                  setActiveSessionId(null);
                  setIsNewSession(false);
                  setViewingHistorySession(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {dropdownSubjects.some(ds => ds.type === 'primary') && (
                    <SelectGroup>
                      <SelectLabel>Primary Section (Incharge)</SelectLabel>
                      {dropdownSubjects.filter(ds => ds.type === 'primary').map((ds) => (
                        <SelectItem key={`${ds.subject.id}|${ds.sectionId}`} value={`${ds.subject.id}|${ds.sectionId}`}>
                          {ds.subject.code} &mdash; {ds.subject.name} ({ds.sectionName})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {dropdownSubjects.some(ds => ds.type === 'regular') && (
                    <SelectGroup>
                      <SelectLabel>Other Assigned Subjects (Regular)</SelectLabel>
                      {dropdownSubjects.filter(ds => ds.type === 'regular').map((ds) => (
                        <SelectItem key={`${ds.subject.id}|${ds.sectionId}`} value={`${ds.subject.id}|${ds.sectionId}`}>
                          {ds.subject.code} &mdash; {ds.subject.name} ({ds.sectionName})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span className="font-medium">{today}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      {selectedSubjectId ? (
        <Tabs
          value={attendanceView}
          onValueChange={(value) =>
            setAttendanceView(value as 'today' | 'history')
          }
        >
          <TabsList className="mb-4">
            <TabsTrigger value="today">Today's Sessions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* ============================================================= */}
          {/* TODAY TAB                                                       */}
          {/* ============================================================= */}
          <TabsContent value="today">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Session chips */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2">

                      <span className="mr-1 text-sm font-medium text-muted-foreground">
                        Sessions:
                      </span>
                      {todaySessions.map((session) => (
                        <Button
                          key={session.id}
                          variant={
                            activeSessionId === session.id
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => handleSelectSession(session)}
                        >
                          Period {session.periodNumber}
                          {session.lockedByTeacher && (
                            <Lock className="ml-1 size-3" />
                          )}
                        </Button>
                      ))}
                      <Button
                        variant={isNewSession ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleNewSession}
                      >
                        <Plus className="size-4" />
                        New (P{nextPeriod})
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Read-only banner */}
                {isReadOnly && activeSession && (
                  <ReadOnlyBanner name={activeSession.createdBy.name} />
                )}

                {/* Marking area */}
                {showMarkingUI && (
                  <MarkingArea
                    displayStudents={displayStudents}
                    studentsCount={students.length}
                    summary={summary}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    sortOrder={effectiveSortOrder}
                    setSortOrder={setSortOrder}
                    isReadOnly={isReadOnly}
                    isSaving={isSaving}
                    toggleAttendance={toggleAttendance}
                    toggleDutyLeave={toggleDutyLeave}
                    markAllPresent={markAllPresent}
                    handleSaveClick={handleSaveClick}
                    hasRecords={records.size > 0}
                    showEditConfirmation={showEditConfirmation}
                    setShowEditConfirmation={setShowEditConfirmation}
                    handleConfirmedSave={handleConfirmedSave}
                  />
                )}

                {/* Empty state */}
                {!showMarkingUI && (
                  <EmptySession
                    nextPeriod={nextPeriod}
                    onNew={handleNewSession}
                  />
                )}
              </div>
            )}
          </TabsContent>

          {/* ============================================================= */}
          {/* HISTORY TAB                                                     */}
          {/* ============================================================= */}
          <TabsContent value="history">
            {viewingHistorySession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDateLabel(viewingHistorySession.date)} &middot;
                      Period {viewingHistorySession.periodNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marked by {viewingHistorySession.createdBy.name}
                      {viewingHistorySession.lockedByTeacher && ' (locked)'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeHistoryView}
                  >
                    Back
                  </Button>
                </div>

                {isReadOnly && (
                  <ReadOnlyBanner
                    name={viewingHistorySession.createdBy.name}
                  />
                )}

                <HistoryRecordList
                  session={viewingHistorySession}
                  students={students}
                  sortOrder={effectiveSortOrder}
                  sortDirection={sortDirection}
                />
              </div>
            ) : historyByDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <Clock className="size-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  No past attendance records for this subject
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyByDate.map(([date, sessions]) => (
                  <Card key={date}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                      onClick={() => toggleDateExpanded(date)}
                    >
                      {expandedDates.has(date) ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {formatDateLabel(date)}
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        {sessions.length} period
                        {sessions.length !== 1 ? 's' : ''}
                      </Badge>
                    </button>
                    {expandedDates.has(date) && (
                      <div className="border-t">
                        {sessions.map((session) => {
                          const s = getSessionSummary(session);
                          const pct =
                            s.total > 0
                              ? Math.round(
                                  ((s.present + s.dl) / s.total) * 100,
                                )
                              : 0;
                          return (
                            <div
                              key={session.id}
                              className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  Period {session.periodNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {s.present}P &middot; {s.absent}A &middot;{' '}
                                  {s.dl}DL &middot; {pct}%
                                  {session.lockedByTeacher && (
                                    <span className="ml-1.5 inline-flex items-center gap-0.5">
                                      <Lock className="size-3" /> Locked
                                    </span>
                                  )}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  handleViewHistorySession(session)
                                }
                              >
                                <Eye className="size-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        /* No subject selected */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-base font-medium text-muted-foreground">
            Select a subject to begin
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Choose a subject from the dropdown above to mark or view attendance
          </p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function ReadOnlyBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Shield className="size-4 shrink-0" />
      <span>
        This session was marked by <strong>{name}</strong> and cannot be edited.
      </span>
    </div>
  );
}

function EmptySession({
  nextPeriod,
  onNew,
}: {
  nextPeriod: number;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <BookOpen className="size-10 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        Select an existing session or create a new one
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onNew}>
        <Plus className="size-4" />
        New Session (Period {nextPeriod})
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MarkingArea
// ---------------------------------------------------------------------------

interface MarkingAreaProps {
  displayStudents: StudentRow[];
  studentsCount: number;
  summary: { total: number; present: number; absent: number; dutyLeave: number };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  sortOrder: 'original' | 'roll_number' | 'name';
  setSortOrder: (order: 'original' | 'roll_number' | 'name') => void;
  isReadOnly: boolean;
  isSaving: boolean;
  toggleAttendance: (id: string) => void;
  toggleDutyLeave: (id: string) => void;
  markAllPresent: () => void;
  handleSaveClick: () => void;
  hasRecords: boolean;
  showEditConfirmation: boolean;
  setShowEditConfirmation: (show: boolean) => void;
  handleConfirmedSave: () => void;
}

function MarkingArea({
  displayStudents,
  studentsCount,
  summary,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sortOrder,
  setSortOrder,
  isReadOnly,
  isSaving,
  toggleAttendance,
  toggleDutyLeave,
  markAllPresent,
  handleSaveClick,
  hasRecords,
  showEditConfirmation,
  setShowEditConfirmation,
  handleConfirmedSave,
}: MarkingAreaProps) {
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const listRef = useCallback((node: HTMLDivElement | null) => {
    scrollElementRef.current = node;
  }, []);
  const rowVirtualizer = useVirtualizer({
    count: displayStudents.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val: any) => setStatusFilter(val as StatusFilter)}
        >
          <SelectTrigger className="w-[120px]">
            <Filter className="mr-1 size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="dl">Duty Leave</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortOrder}
          onValueChange={(val: any) =>
            setSortOrder(val as 'original' | 'roll_number' | 'name')
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">Original File</SelectItem>
            <SelectItem value="roll_number">Roll No.</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Student list */}
      <Card>
        <div ref={listRef} className="max-h-[60vh] overflow-auto">
          {/* Header row */}
          <div className="sticky top-0 z-10 grid w-full grid-cols-[4.5rem_minmax(0,1fr)_4.2rem_2.5rem] items-center gap-1 bg-background px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid-cols-[6.5rem_1fr_5rem_3.5rem] sm:gap-2 sm:px-4 sm:text-xs">
            <span>Roll</span>
            <span>Name</span>
            <span className="text-center">Status</span>
            <span className="text-center">DL</span>
          </div>

          {displayStudents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {studentsCount === 0
                ? 'No active students in this section'
                : 'No students match the current filter'}
            </div>
          ) : (
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {virtualRows.map((virtualRow) => {
              const row = displayStudents[virtualRow.index];
              if (!row) return null;
              const { student, isPresent, isDutyLeave } = row;

              return (
              <div
                key={student.id}
                className={cn(
                  'grid w-full grid-cols-[4.5rem_minmax(0,1fr)_4.2rem_2.5rem] items-center gap-1 px-2 py-2.5 transition-colors sm:grid-cols-[6.5rem_1fr_5rem_3.5rem] sm:gap-2 sm:px-4',
                  isDutyLeave
                    ? 'bg-amber-50'
                    : !isPresent
                      ? 'bg-red-50/50'
                      : '',
                  !isReadOnly && 'cursor-pointer hover:bg-muted/50',
                )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                onClick={() => toggleAttendance(student.id)}
              >
                <span className="truncate text-[11px] text-muted-foreground sm:font-mono sm:text-sm sm:whitespace-nowrap">
                  {student.rollNumber}
                </span>
                <span className="truncate text-[11px] font-medium sm:text-sm">
                  {student.fullName}
                </span>
                <div className="flex items-center justify-center">
                  <StatusBadge
                    isPresent={isPresent}
                    isDutyLeave={isDutyLeave}
                  />
                </div>
                <div className="flex items-center justify-center">
                  {!isReadOnly && (
                    <Button
                      variant={isDutyLeave ? 'default' : 'outline'}
                      size="xs"
                      className={cn(
                        isDutyLeave &&
                          'bg-amber-600 text-white hover:bg-amber-700',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDutyLeave(student.id);
                      }}
                    >
                      DL
                    </Button>
                  )}
                </div>
              </div>
            );
            })}
            </div>
          )}
        </div>
      </Card>

      {/* Summary + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            Present: <strong>{summary.present}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500" />
            Absent: <strong>{summary.absent}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" />
            DL: <strong>{summary.dutyLeave}</strong>
          </span>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            Total: <strong>{summary.total}</strong>
          </span>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              <RotateCcw className="size-4" />
              Mark All Present
            </Button>
            <Button
              size="sm"
              onClick={handleSaveClick}
              disabled={isSaving || !hasRecords}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        )}
      </div>

      {/* Edit Confirmation Dialog */}
      <Dialog
        open={showEditConfirmation}
        onOpenChange={setShowEditConfirmation}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Changes</DialogTitle>
            <DialogDescription>
              Are you sure you want to edit and save these changes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleConfirmedSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({
  isPresent,
  isDutyLeave,
}: {
  isPresent: boolean;
  isDutyLeave: boolean;
}) {
  if (isDutyLeave) {
    return (
      <Badge className="bg-amber-100 px-1 py-0.5 text-[9px] text-amber-800 sm:px-2 sm:text-xs">
        DL
      </Badge>
    );
  }
  if (isPresent) {
    return (
      <Badge className="bg-emerald-100 px-1 py-0.5 text-[9px] text-emerald-800 sm:px-2 sm:text-xs">
        Present
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 px-1 py-0.5 text-[9px] text-red-800 sm:px-2 sm:text-xs">
      Absent
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// HistoryRecordList (read-only view of a past session)
// ---------------------------------------------------------------------------

function HistoryRecordList({
  session,
  students,
  sortOrder,
  sortDirection,
}: {
  session: AttendanceSession;
  students: Student[];
  sortOrder: 'original' | 'roll_number' | 'name';
  sortDirection: 'asc' | 'desc';
}) {
  const studentMap = useMemo(() => {
    const m = new Map<string, Student>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const rows = useMemo(() => {
    const list = session.records.map((r) => {
      const student = studentMap.get(r.studentId);
      return {
        record: r,
        student: student,
        rollNumber: student?.rollNumber ?? r.rollNumber,
        fullName: student?.fullName ?? 'Unknown Student',
      };
    });

    if (sortOrder === 'name') {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (sortOrder === 'roll_number') {
      list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
    } else {
      list.sort((a, b) => {
        const timeDiff = (a.student?.uploadedAt ?? '').localeCompare(b.student?.uploadedAt ?? '');
        return timeDiff !== 0
          ? timeDiff
          : a.rollNumber.localeCompare(b.rollNumber);
      });
    }

    if (sortDirection === 'desc') {
      list.reverse();
    }

    return list;
  }, [session.records, studentMap, sortOrder, sortDirection]);

  const summary = useMemo(() => {
    const recs = session.records;
    return {
      total: recs.length,
      present: recs.filter((r) => r.isPresent && !r.isDutyLeave).length,
      absent: recs.filter((r) => !r.isPresent).length,
      dl: recs.filter((r) => r.isDutyLeave).length,
    };
  }, [session.records]);

  return (
    <>
      <Card>
        <div className="divide-y">
          <div className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_4.2rem] items-center gap-1 px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid-cols-[6.5rem_1fr_5rem] sm:gap-2 sm:px-4 sm:text-xs">
            <span>Roll</span>
            <span>Name</span>
            <span className="text-center">Status</span>
          </div>
          {rows.map(({ record, rollNumber, fullName }) => (
            <div
              key={record.studentId}
              className={cn(
                'grid w-full grid-cols-[4.5rem_minmax(0,1fr)_4.2rem] items-center gap-1 px-2 py-2.5 sm:grid-cols-[6.5rem_1fr_5rem] sm:gap-2 sm:px-4',
                record.isDutyLeave
                  ? 'bg-amber-50'
                  : !record.isPresent
                    ? 'bg-red-50/50'
                    : '',
              )}
            >
              <span className="truncate text-[11px] text-muted-foreground sm:font-mono sm:text-sm sm:whitespace-nowrap">
                {rollNumber}
              </span>
              <span className="truncate text-[11px] font-medium sm:text-sm">{fullName}</span>
              <div className="flex items-center justify-center">
                <StatusBadge
                  isPresent={record.isPresent}
                  isDutyLeave={record.isDutyLeave}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          Present: <strong>{summary.present}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500" />
          Absent: <strong>{summary.absent}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" />
          DL: <strong>{summary.dl}</strong>
        </span>
        <Separator orientation="vertical" className="hidden h-4 sm:block" />
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" />
          Total: <strong>{summary.total}</strong>
        </span>
      </div>
    </>
  );
}
