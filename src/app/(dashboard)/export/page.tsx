'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getDepartments, getSections, getBranches } from '@/lib/db/university';
import { getStudents } from '@/lib/db/students';
import { getSubjects } from '@/lib/db/subjects';
import { getAttendanceSessions } from '@/lib/db/attendance';
import { getUserSections, getPrimarySectionId } from '@/lib/db/user-sections';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Department,
  Section,
  Branch,
  Student,
  Subject,
  AttendanceSession,
} from '@/lib/types';
import {
  FileDown,
  User,
  BookOpen,
  Users,
  Loader2,
  FileText,
  Info,
} from 'lucide-react';

type ExportFormat = 'per-student' | 'per-subject' | 'per-section';

export default function ExportPage() {
  const { user, university } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ExportFormat>('per-student');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [_teacherSectionIds, setTeacherSectionIds] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isPrimaryTeacher = user?.role === 'primary_teacher';

  const canAccess = isSuperAdmin || isAdmin || isPrimaryTeacher;

  useEffect(() => {
    if (!university || !user || !canAccess) return;

    async function loadInitialData() {
      if (!university || !user) return;
      setIsLoadingData(true);
      try {
        if (isSuperAdmin) {
          const depts = await getDepartments(university.id);
          setDepartments(depts);
          const allBranches = await getBranches(university.id);
          setBranches(allBranches);
        } else if (isAdmin && user.departmentId) {
          const allSections = await getSections(university.id, user.departmentId);
          setSections(allSections.filter((s) => s.isActive && !s.isArchived));
          const deptBranches = await getBranches(university.id, user.departmentId);
          setBranches(deptBranches);
        } else if (isPrimaryTeacher) {
          const ptSectionId = await getPrimarySectionId(user.id);
          const ptSectionIds = ptSectionId ? [ptSectionId] : [];
          setTeacherSectionIds(ptSectionIds);
          if (ptSectionIds.length > 0) {
            const allSections = await getSections(university.id);
            const mySections = allSections.filter(
              (s) => ptSectionIds.includes(s.id) && s.isActive && !s.isArchived
            );
            setSections(mySections);
            const allBranches = await getBranches(university.id);
            setBranches(allBranches);
            if (mySections.length === 1) {
              setSelectedSection(mySections[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        toast.error('Failed to load data');
      }
      setIsLoadingData(false);
    }

    loadInitialData();
  }, [university, user, canAccess, isSuperAdmin, isAdmin, isPrimaryTeacher]);

  useEffect(() => {
    if (!university || !selectedDepartment || !isSuperAdmin) return;

    async function loadSectionsForDept() {
      if (!university) return;
      try {
        const allSections = await getSections(university.id, selectedDepartment);
        setSections(allSections.filter((s) => s.isActive && !s.isArchived));
      } catch (err) {
        console.error('Failed to load sections:', err);
      }
    }

    setSelectedSection('');
    setStudents([]);
    setSubjects([]);
    setSessions([]);
    setSelectedStudent('');
    setSelectedSubject('');
    loadSectionsForDept();
  }, [university, selectedDepartment, isSuperAdmin]);

  useEffect(() => {
    if (!selectedSection) {
      setStudents([]);
      setSubjects([]);
      setSessions([]);
      setSelectedStudent('');
      setSelectedSubject('');
      return;
    }

    async function loadSectionData() {
      try {
        const [studs, subs, sess] = await Promise.all([
          getStudents(selectedSection),
          getSubjects(selectedSection),
          getAttendanceSessions(selectedSection),
        ]);
        setStudents(studs);
        setSubjects(subs);
        setSessions(sess.filter((s) => !s.isArchived));
      } catch (err) {
        console.error('Failed to load section data:', err);
        toast.error('Failed to load section data');
      }
    }

    setSelectedStudent('');
    setSelectedSubject('');
    loadSectionData();
  }, [selectedSection]);

  const filteredStudents = useMemo(() => {
    const activeStudents = students.filter((s) => s.isActive);
    return [...activeStudents].sort((a, b) => {
      const timeDiff = (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? '');
      if (timeDiff !== 0) return timeDiff;
      return a.rollNumber.localeCompare(b.rollNumber);
    });
  }, [students]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    });
  }, [sessions, startDate, endDate]);

  const exportSummary = useMemo(() => {
    if (!selectedSection) return null;

    const sectionObj = sections.find((s) => s.id === selectedSection);
    const sectionName = sectionObj?.name ?? 'Unknown Section';

    if (activeTab === 'per-student') {
      if (!selectedStudent) return null;
      const studentObj = filteredStudents.find((s) => s.id === selectedStudent);
      const relevantSessions = filteredSessions;
      const subjectCount = subjects.length;
      return {
        title: `Student Report: ${studentObj?.fullName ?? 'Unknown'}`,
        details: [
          `Section: ${sectionName}`,
          `Roll Number: ${studentObj?.rollNumber ?? '-'}`,
          `Subjects: ${subjectCount}`,
          `Sessions in range: ${relevantSessions.length}`,
          startDate ? `From: ${startDate}` : 'From: All time',
          endDate ? `To: ${endDate}` : 'To: Present',
        ],
      };
    }

    if (activeTab === 'per-subject') {
      if (!selectedSubject) return null;
      const subjectObj = subjects.find((s) => s.id === selectedSubject);
      const relevantSessions = filteredSessions.filter(
        (s) => s.subjectId === selectedSubject
      );
      return {
        title: `Subject Report: ${subjectObj?.name ?? 'Unknown'} (${subjectObj?.code ?? ''})`,
        details: [
          `Section: ${sectionName}`,
          `Students: ${filteredStudents.length}`,
          `Sessions in range: ${relevantSessions.length}`,
          startDate ? `From: ${startDate}` : 'From: All time',
          endDate ? `To: ${endDate}` : 'To: Present',
        ],
      };
    }

    if (activeTab === 'per-section') {
      return {
        title: `Section Report: ${sectionName}`,
        details: [
          `Students: ${filteredStudents.length}`,
          `Subjects: ${subjects.length}`,
          `Sessions in range: ${filteredSessions.length}`,
          startDate ? `From: ${startDate}` : 'From: All time',
          endDate ? `To: ${endDate}` : 'To: Present',
        ],
      };
    }

    return null;
  }, [
    activeTab,
    selectedSection,
    selectedStudent,
    selectedSubject,
    sections,
    filteredStudents,
    subjects,
    filteredSessions,
    startDate,
    endDate,
  ]);

  const canGenerate = useMemo(() => {
    if (!selectedSection) return false;
    if (activeTab === 'per-student' && !selectedStudent) return false;
    if (activeTab === 'per-subject' && !selectedSubject) return false;
    return true;
  }, [activeTab, selectedSection, selectedStudent, selectedSubject]);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const sectionObj = sections.find((s) => s.id === selectedSection);
      const sectionName = sectionObj?.name ?? 'Unknown Section';
      const universityName = university?.name ?? 'University';
      const generatedByName = user?.fullName ?? 'Unknown';
      const generatedByRole = user?.role?.replace('_', ' ') ?? 'user';
      const threshold = university?.attendanceThreshold ?? 75;

      if (activeTab === 'per-student') {
        const { generateStudentPDF } = await import('@/lib/utils/pdf-generator');
        const studentObj = filteredStudents.find((s) => s.id === selectedStudent);
        if (!studentObj) throw new Error('Student not found');
        await generateStudentPDF({
          universityName,
          generatedByName,
          generatedByRole,
          student: studentObj,
          subjects,
          sessions: filteredSessions,
          sectionName,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          threshold,
        });
      } else if (activeTab === 'per-subject') {
        const { generateSubjectPDF } = await import('@/lib/utils/pdf-generator');
        const subjectObj = subjects.find((s) => s.id === selectedSubject);
        if (!subjectObj) throw new Error('Subject not found');
        await generateSubjectPDF({
          universityName,
          generatedByName,
          generatedByRole,
          subject: subjectObj,
          students: filteredStudents,
          sessions: filteredSessions,
          sectionName,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          threshold,
        });
      } else if (activeTab === 'per-section') {
        const { generateSectionPDF } = await import('@/lib/utils/pdf-generator');
        const branchObj = branches.find((b) => b.id === sectionObj?.branchId);
        await generateSectionPDF({
          universityName,
          generatedByName,
          generatedByRole,
          sectionName,
          branchName: branchObj?.name ?? sectionName,
          subjects,
          students: filteredStudents,
          sessions: filteredSessions,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          threshold,
        });
      }
      toast.success('PDF generated successfully!');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTabChange = (value: ExportFormat | (string & {})) => {
    setActiveTab(value as ExportFormat);
    setSelectedStudent('');
    setSelectedSubject('');
  };

  if (!user || !canAccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          You do not have permission to access the export page.
        </p>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileDown className="size-6" />
          Export Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate PDF attendance reports for students, subjects, or sections
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full sm:w-fit flex-wrap sm:flex-nowrap">
          <TabsTrigger value="per-student" className="flex-1 sm:flex-none">
            <User className="size-4 mr-1.5 hidden sm:block" />
            <span className="sm:hidden">Student</span>
            <span className="hidden sm:inline">Per Student</span>
          </TabsTrigger>
          <TabsTrigger value="per-subject" className="flex-1 sm:flex-none">
            <BookOpen className="size-4 mr-1.5 hidden sm:block" />
            <span className="sm:hidden">Subject</span>
            <span className="hidden sm:inline">Per Subject</span>
          </TabsTrigger>
          <TabsTrigger value="per-section" className="flex-1 sm:flex-none">
            <Users className="size-4 mr-1.5 hidden sm:block" />
            <span className="sm:hidden">Section</span>
            <span className="hidden sm:inline">Per Section</span>
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">
              {activeTab === 'per-student' && 'Student Report Filters'}
              {activeTab === 'per-subject' && 'Subject Report Filters'}
              {activeTab === 'per-section' && 'Section Report Filters'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'per-student' &&
                'Select a student to generate a report across all subjects and dates'}
              {activeTab === 'per-subject' &&
                'Select a subject to generate a report for all students and dates'}
              {activeTab === 'per-section' &&
                'Select a section to generate a full report with all subjects and students'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isSuperAdmin && (
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select
                  value={selectedDepartment}
                  onValueChange={(val) => setSelectedDepartment(val as string)}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Section</Label>
              <Select
                value={selectedSection}
                onValueChange={(val) => setSelectedSection(val as string)}
                disabled={
                  isSuperAdmin
                    ? !selectedDepartment
                    : sections.length === 0
                }
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSuperAdmin && !selectedDepartment && (
                <p className="text-xs text-muted-foreground">
                  Select a department first
                </p>
              )}
            </div>

            <TabsContent value="per-student">
              <div className="flex flex-col gap-1.5">
                <Label>Student</Label>
                <Select
                  value={selectedStudent}
                  onValueChange={(val) => setSelectedStudent(val as string)}
                  disabled={!selectedSection || filteredStudents.length === 0}
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Select Student" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map((stu) => (
                        <SelectItem key={stu.id} value={stu.id}>
                          {stu.rollNumber} - {stu.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedSection && filteredStudents.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No students found in this section
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="per-subject">
              <div className="flex flex-col gap-1.5">
                <Label>Subject</Label>
                <Select
                  value={selectedSubject}
                  onValueChange={(val) => setSelectedSubject(val as string)}
                  disabled={!selectedSection || subjects.length === 0}
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSection && subjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No subjects found in this section
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="per-section">
              {selectedSection && (
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <Info className="size-4 shrink-0" />
                  All subjects and students in the selected section will be included
                </div>
              )}
            </TabsContent>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:w-fit">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-start-date">Start Date</Label>
                <Input
                  id="export-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-end-date">End Date</Label>
                <Input
                  id="export-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </Tabs>

      {exportSummary && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="size-4" />
              Export Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <h3 className="font-semibold">{exportSummary.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {exportSummary.details.map((detail, i) => (
                <Badge key={i} variant="secondary">
                  {detail}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!canGenerate || isGenerating}
          onClick={generatePDF}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin mr-1.5" />
              Generating...
            </>
          ) : (
            <>
              <FileDown className="size-4 mr-1.5" />
              Generate PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
