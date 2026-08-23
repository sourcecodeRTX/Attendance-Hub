'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, BookOpen, GraduationCap, BarChart3, Clock, AlertTriangle, Activity,
} from 'lucide-react';
import { getDepartments, getSections } from '@/lib/db/university';
import { getStudents } from '@/lib/db/students';
import { getSubjects } from '@/lib/db/subjects';
import { getAttendanceSessions } from '@/lib/db/attendance';
import { getUserSections, getUserSubjects, getPrimarySectionId } from '@/lib/db/user-sections';
import { getActivityLogs } from '@/lib/db/activity';
import { useLocalDateString } from '@/hooks/use-local-date';
import { computeCRSectionStats } from '@/lib/utils/cr-metrics';
import { db } from '@/lib/db';
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert';
import type { AttendanceSession, ActivityLog } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  primary_teacher: 'Primary Teacher',
  regular_teacher: 'Regular Teacher',
  cr: 'Class Representative',
};

function calcAttendancePercent(sessions: AttendanceSession[]): number {
  let total = 0;
  let present = 0;
  for (const s of sessions) {
    for (const r of s.records) {
      total++;
      if (r.isPresent || r.isDutyLeave) present++;
    }
  }
  return total === 0 ? 0 : Math.round((present / total) * 100);
}

/* â”€â”€ Shared UI pieces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function LoadErrorNotice() {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle className="size-4" />
      <AlertTitle>Couldn&apos;t load dashboard data</AlertTitle>
      <AlertDescription>
        A data load failed, so the statistics below may be incomplete or stale.
        They do NOT mean your institution has no data. Try refreshing the page.
      </AlertDescription>
    </Alert>
  );
}

function ActivityFeed({ activities }: { activities: ActivityLog[] }) {
  if (activities.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p>
                  <span className="font-medium">{a.performedByName}</span>{' '}
                  <span className="text-muted-foreground">{a.actionType.replace(/_/g, ' ')}</span>
                  {a.targetName && <span> - {a.targetName}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.departmentName}{a.sectionName ? ` - ${a.sectionName}` : ''}
                  {a.createdAt ? ` - ${new Date(a.createdAt).toLocaleString()}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* â”€â”€ Super Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SuperAdminDashboard() {
  const { user, university } = useAuthStore();
  const [departmentCount, setDepartmentCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [overallAttendance, setOverallAttendance] = useState(0);
  const [deptSummary, setDeptSummary] = useState<{ name: string; code: string; sections: number; students: number; attendance: number; admins: string }[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!user || !university) return;
    const uid = university.id;

    (async () => {
      try {
      const [departments, allUsers, allStudents, sections, logs] = await Promise.all([
        getDepartments(uid),
        db.users.where('universityId').equals(uid).toArray(),
        db.students.where('universityId').equals(uid).toArray(),
        getSections(uid),
        getActivityLogs(uid, { limit: 20 }),
      ]);

      setDepartmentCount(departments.length);
      setUserCount(allUsers.filter((u) => u.role !== 'super_admin').length);
      const activeStudents = allStudents.filter((s) => s.isActive);
      setStudentCount(activeStudents.length);
      setRecentActivity(logs);

      const sectionSessionsMap = new Map<string, AttendanceSession[]>();
      const allSessions: AttendanceSession[] = [];
      await Promise.all(
        sections.map(async (sec) => {
          const sess = await getAttendanceSessions(sec.id);
          sectionSessionsMap.set(sec.id, sess);
          allSessions.push(...sess);
        }),
      );
      setOverallAttendance(calcAttendancePercent(allSessions));

      const deptMeta = new Map<string, { sids: string[]; students: number }>();
      for (const d of departments) deptMeta.set(d.id, { sids: [], students: 0 });
      for (const sec of sections) deptMeta.get(sec.departmentId)?.sids.push(sec.id);
      for (const s of activeStudents) {
        const m = deptMeta.get(s.departmentId);
        if (m) m.students++;
      }

      setDeptSummary(
        departments.map((d) => {
          const m = deptMeta.get(d.id)!;
          const dSess: AttendanceSession[] = [];
          for (const sid of m.sids) dSess.push(...(sectionSessionsMap.get(sid) ?? []));
          const deptAdmins = allUsers
            .filter((u) => u.role === 'admin' && u.departmentId === d.id && u.isActive)
            .map((u) => u.fullName);
          return {
            name: d.name,
            code: d.code,
            sections: m.sids.length,
            students: m.students,
            attendance: calcAttendancePercent(dSess),
            admins: deptAdmins.length > 0 ? deptAdmins.join(', ') : 'Unassigned',
          };
        }),
      );
      } catch (err) {
        console.error('SuperAdminDashboard: Error loading data:', err);
        setLoadFailed(true);
      }
    })();
  }, [user, university]);

  const threshold = university?.attendanceThreshold ?? 75;

  return (
    <>
      {loadFailed && <LoadErrorNotice />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<BookOpen className="h-4 w-4" />} title="Total Departments" value={departmentCount} />
        <StatCard icon={<Users className="h-4 w-4" />} title="Total Users" value={userCount} />
        <StatCard icon={<GraduationCap className="h-4 w-4" />} title="Total Students" value={studentCount} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} title="University Attendance" value={`${overallAttendance}%`} />
      </div>

      {deptSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Department-wise Attendance</CardTitle>
            <CardDescription>Overview of all departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Assigned Admins</TableHead>
                    <TableHead className="text-center">Sections</TableHead>
                    <TableHead className="text-center">Students</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptSummary.map((d) => (
                    <TableRow key={d.code}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.code}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">{d.admins}</TableCell>
                      <TableCell className="text-center">{d.sections}</TableCell>
                      <TableCell className="text-center">{d.students}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={d.attendance < threshold ? 'destructive' : 'secondary'}>{d.attendance}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ActivityFeed activities={recentActivity} />
    </>
  );
}

/* â”€â”€ Admin (department-scoped) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function AdminDashboard() {
  const { user, university } = useAuthStore();
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [crCount, setCrCount] = useState(0);
  const [deptAttendance, setDeptAttendance] = useState(0);
  const [sectionSummary, setSectionSummary] = useState<{ name: string; students: number; attendance: number }[]>([]);
  const [teacherList, setTeacherList] = useState<Array<{ name: string; role: string; staffId: string }>>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!user || !university || !user.departmentId) return;
    const uid = university.id;
    const deptId = user.departmentId;

    (async () => {
      try {
      const [sections, deptStudents, deptUsers, logs] = await Promise.all([
        getSections(uid, deptId),
        db.students.where('departmentId').equals(deptId).toArray(),
        db.users.where('departmentId').equals(deptId).toArray(),
        getActivityLogs(uid, { departmentId: deptId, limit: 20 }),
      ]);

      setStudentCount(deptStudents.filter((s) => s.isActive).length);
      const deptTeachers = deptUsers.filter((u) => u.role === 'primary_teacher' || u.role === 'regular_teacher');
      setTeacherCount(deptTeachers.length);
      setCrCount(deptUsers.filter((u) => u.role === 'cr').length);
      setTeacherList(
        deptTeachers.map((u) => ({
          name: u.fullName,
          role: ROLE_LABELS[u.role] ?? u.role,
          staffId: u.staffId,
        })),
      );
      setRecentActivity(logs);

      const allSessions: AttendanceSession[] = [];
      const list: { name: string; students: number; attendance: number }[] = [];

      await Promise.all(
        sections.map(async (sec) => {
          const [sess, studs] = await Promise.all([getAttendanceSessions(sec.id), getStudents(sec.id)]);
          allSessions.push(...sess);
          list.push({ name: sec.name, students: studs.filter((s) => s.isActive).length, attendance: calcAttendancePercent(sess) });
        }),
      );

      setDeptAttendance(calcAttendancePercent(allSessions));
      setSectionSummary(list);
      } catch (err) {
        console.error('AdminDashboard: Error loading data:', err);
        setLoadFailed(true);
      }
    })();
  }, [user, university]);

  const threshold = university?.attendanceThreshold ?? 75;

  return (
    <>
      {loadFailed && <LoadErrorNotice />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<GraduationCap className="h-4 w-4" />} title="Total Students" value={studentCount} />
        <StatCard icon={<Users className="h-4 w-4" />} title="Teachers" value={teacherCount} />
        <StatCard icon={<Users className="h-4 w-4" />} title="Class Reps" value={crCount} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} title="Dept Attendance" value={`${deptAttendance}%`} />
      </div>

      {sectionSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Section-wise Attendance</CardTitle>
            <CardDescription>All sections in your department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-center">Students</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionSummary.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">{s.students}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.attendance < threshold ? 'destructive' : 'secondary'}>{s.attendance}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {teacherList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Teachers in Department</CardTitle>
            <CardDescription>All active teachers assigned to your department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Staff ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherList.map((teacher) => (
                    <TableRow key={`${teacher.staffId}-${teacher.name}`}>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>{teacher.role}</TableCell>
                      <TableCell>{teacher.staffId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ActivityFeed activities={recentActivity} />
    </>
  );
}

/* ── Unified Teacher Dashboard (primary + regular) ─────────────── */

function TeacherDashboard() {
  const { user, university } = useAuthStore();
  const today = useLocalDateString();
  const [studentCount, setStudentCount] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [overallAttendance, setOverallAttendance] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);
  const [subjectSummary, setSubjectSummary] = useState<{ name: string; code: string; sessions: number; attendance: number; type: 'primary' | 'regular'; sectionName: string }[]>([]);
  const [crSessions, setCrSessions] = useState<AttendanceSession[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!user || !university) return;

    (async () => {
      try {
        const primarySectionId = await getPrimarySectionId(user.id);
        const userSubjectsData = await getUserSubjects(user.id);

        if (!primarySectionId && userSubjectsData.length === 0) {
          setDataLoaded(true);
          return;
        }

        const allSectionIds = new Set<string>();
        if (primarySectionId) allSectionIds.add(primarySectionId);
        userSubjectsData.forEach(us => allSectionIds.add(us.sectionId));

        const sectionNameMap = new Map<string, string>();
        await Promise.all(
          Array.from(allSectionIds).map(async (sid) => {
            const sec = await db.sections.get(sid);
            if (sec) sectionNameMap.set(sec.id, sec.name);
          })
        );

        let primaryStudents: Awaited<ReturnType<typeof getStudents>> = [];
        let primarySessions: AttendanceSession[] = [];
        let primarySubjects: Awaited<ReturnType<typeof getSubjects>> = [];

        if (primarySectionId) {
          [primaryStudents, primarySubjects, primarySessions] = await Promise.all([
            getStudents(primarySectionId),
            getSubjects(primarySectionId),
            getAttendanceSessions(primarySectionId),
          ]);
        }

        const combinedSummary: typeof subjectSummary = [];
        const allSessions: AttendanceSession[] = [...primarySessions];
        let todayCount = primarySessions.filter(s => s.date === today).length;
        const processedSubjectSections = new Set<string>();

        if (primarySectionId) {
          const primarySectionName = sectionNameMap.get(primarySectionId) ?? 'Unknown Section';
          for (const sub of primarySubjects) {
            const key = `${sub.id}|${primarySectionId}`;
            processedSubjectSections.add(key);
            const subSess = primarySessions.filter(s => s.subjectId === sub.id);
            combinedSummary.push({
              name: sub.name,
              code: sub.code,
              sessions: subSess.length,
              attendance: calcAttendancePercent(subSess),
              type: 'primary',
              sectionName: primarySectionName,
            });
          }
        }

        await Promise.all(
          userSubjectsData.map(async (us) => {
            const key = `${us.subjectId}|${us.sectionId}`;
            if (processedSubjectSections.has(key)) return;
            processedSubjectSections.add(key);

            const sub = await db.subjects.get(us.subjectId);
            if (!sub) return;

            const regSessions = await getAttendanceSessions(us.sectionId);
            const subSess = regSessions.filter(s => s.subjectId === sub.id);
            
            if (us.sectionId !== primarySectionId) {
              allSessions.push(...subSess);
              todayCount += subSess.filter(s => s.date === today).length;
            }

            const section = await db.sections.get(us.sectionId);
            const isPrimaryForThisSection = section?.primaryTeacherId === user.id;

            combinedSummary.push({
              name: sub.name,
              code: sub.code,
              sessions: subSess.length,
              attendance: calcAttendancePercent(subSess),
              type: isPrimaryForThisSection ? 'primary' : 'regular',
              sectionName: sectionNameMap.get(us.sectionId) ?? 'Unknown',
            });
          })
        );

        const activeStudentCount = primaryStudents.filter(s => s.isActive).length;
        const regularSectionIds = Array.from(allSectionIds).filter(sid => sid !== primarySectionId);
        let regularStudentCount = 0;
        for (const sid of regularSectionIds) {
          const studs = await getStudents(sid);
          regularStudentCount += studs.filter(s => s.isActive).length;
        }

        setStudentCount(activeStudentCount + regularStudentCount);
        setSubjectCount(combinedSummary.length);
        setTodaySessions(todayCount);
        setOverallAttendance(calcAttendancePercent(allSessions));
        setSubjectSummary(combinedSummary);

        if (primarySessions.length > 0) {
          setCrSessions(
            primarySessions
              .filter(s => s.createdBy?.role === 'cr')
              .sort((a, b) => (b.createdBy?.markedAt ?? '').localeCompare(a.createdBy?.markedAt ?? ''))
              .slice(0, 10),
          );
        }

        setDataLoaded(true);
      } catch (err) {
        console.error('TeacherDashboard: Error loading data:', err);
        setLoadFailed(true);
        setDataLoaded(true);
      }
    })();
  }, [user, university, today]);

  const threshold = university?.attendanceThreshold ?? 75;

  return (
    <>
      {loadFailed && <LoadErrorNotice />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<GraduationCap className="h-4 w-4" />} title="Total Students" value={studentCount} />
        <StatCard icon={<Clock className="h-4 w-4" />} title="Today&apos;s Sessions" value={todaySessions} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} title="Overall Attendance" value={`${overallAttendance}%`} />
        <StatCard icon={<BookOpen className="h-4 w-4" />} title="Subjects" value={subjectCount} />
      </div>

      <div>
        <Link href="/attendance">
          <Button>Mark Attendance</Button>
        </Link>
      </div>

      {subjectSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Attendance</CardTitle>
            <CardDescription>Attendance breakdown by subject across all assigned sections</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-center">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectSummary.map((s) => (
                  <TableRow key={`${s.code}-${s.sectionName}-${s.type}`}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.code}</TableCell>
                    <TableCell>{s.sectionName}</TableCell>
                    <TableCell>
                      {s.type === 'primary' ? (
                        <Badge variant="default">Primary Class</Badge>
                      ) : (
                        <Badge variant="secondary">Regular Class</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{s.sessions}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={s.attendance < threshold ? 'destructive' : 'secondary'}>{s.attendance}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dataLoaded && !loadFailed && subjectSummary.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No subjects or sections assigned yet. Please contact your admin to get assigned.
            </p>
          </CardContent>
        </Card>
      )}

      {crSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent CR Sessions</CardTitle>
            <CardDescription>Attendance marked by Class Representatives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {crSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{s.date} - Period {s.periodNumber ?? '?'}</p>
                    <p className="text-xs text-muted-foreground">Marked by {s.createdBy?.name ?? 'CR'}</p>
                  </div>
                  <Badge variant={s.lockedByTeacher ? 'secondary' : 'outline'}>
                    {s.lockedByTeacher ? 'Locked' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}


/* â”€â”€ CR (section-scoped) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function CRDashboard() {
  const { user, university } = useAuthStore();
  const today = useLocalDateString();
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [subjectSummary, setSubjectSummary] = useState<{ name: string; code: string; attendance: number }[]>([]);
  const [belowThreshold, setBelowThreshold] = useState<{ rollNumber: string; fullName: string; percentage: number }[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!user || !university) return;
    const threshold = university.attendanceThreshold ?? 75;

    (async () => {
      try {
      const sectionId = await getPrimarySectionId(user.id);
      if (!sectionId) return;

      const [students, subjects, sessions] = await Promise.all([
        getStudents(sectionId),
        getSubjects(sectionId),
        getAttendanceSessions(sectionId),
      ]);

      // Today's totals
      const todaySess = sessions.filter((s) => s.date === today);
      let tp = 0, tt = 0;
      for (const s of todaySess) {
        for (const r of s.records) {
          tt++;
          if (r.isPresent || r.isDutyLeave) tp++;
        }
      }
      setTodayPresent(tp);
      setTodayTotal(tt);
      setTodaySessions(todaySess.length);

      // Subject-wise
      setSubjectSummary(
        subjects.map((sub) => {
          const subSess = sessions.filter((s) => s.subjectId === sub.id);
          return { name: sub.name, code: sub.code, attendance: calcAttendancePercent(subSess) };
        }),
      );

      // Below-threshold students (shared pure helper — students with zero
      // recorded sessions count as 0%, never as a fabricated 100%)
      const active = students.filter((s) => s.isActive);
      const stats = computeCRSectionStats(active, sessions, threshold);
      setActiveStudentCount(stats.activeStudentCount);
      setBelowThreshold(stats.belowThreshold);
      } catch (err) {
        console.error('CRDashboard: Error loading data:', err);
        setLoadFailed(true);
      }
    })();
  }, [user, university, today]);

  const threshold = university?.attendanceThreshold ?? 75;

  return (
    <>
      {loadFailed && <LoadErrorNotice />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} title="Total Students" value={activeStudentCount || 0} />
        <StatCard icon={<Clock className="h-4 w-4" />} title="Today's Sessions" value={todaySessions} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} title="Today's Attendance" value={todayTotal > 0 ? `${Math.round((todayPresent / todayTotal) * 100)}%` : '-'} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} title="Below Threshold" value={belowThreshold.length} />
      </div>

      <div>
        <Link href="/attendance">
          <Button>Mark Attendance</Button>
        </Link>
      </div>

      {subjectSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-center">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectSummary.map((s) => (
                  <TableRow key={s.code}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.code}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={s.attendance < threshold ? 'destructive' : 'secondary'}>{s.attendance}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {belowThreshold.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Students Below Threshold
            </CardTitle>
            <CardDescription>Students below {threshold}% attendance</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {belowThreshold.map((s) => (
                  <TableRow key={s.rollNumber}>
                    <TableCell className="font-medium">{s.rollNumber}</TableCell>
                    <TableCell>{s.fullName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{s.percentage}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function DashboardPage() {
  const { user, university } = useAuthStore();

  if (!user) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center" aria-live="polite" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user.fullName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          {university && (
            <span className="text-sm text-muted-foreground">
              {university.name}
            </span>
          )}
        </div>
      </div>

      {user.role === 'super_admin' && <SuperAdminDashboard />}
      {user.role === 'admin' && <AdminDashboard />}
      {(user.role === 'primary_teacher' || user.role === 'regular_teacher') && <TeacherDashboard />}
      {user.role === 'cr' && <CRDashboard />}
    </div>
  );
}
