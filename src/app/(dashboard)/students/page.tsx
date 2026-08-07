'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import {
  getStudents,
  createStudent,
  createStudentsBulk,
  updateStudent,
  softDeleteStudent,
} from '@/lib/db/students';
import { getUserSections } from '@/lib/db/user-sections';
import { logActivity } from '@/lib/db/activity';
import { db } from '@/lib/db/index';
import { pullFromCloud } from '@/lib/db/sync';
import { subscribeToStudents } from '@/lib/supabase/realtime';
import type { Student, Section, UserSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Upload,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  ArrowRightLeft,
  MoreVertical,
} from 'lucide-react';
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';

export default function StudentsPage() {
  const { user, university } = useAuthStore();
  const { sortOrder, setSortOrder, setSortDirection } = usePreferencesStore();
  const effectiveSortOrder = sortOrder ?? 'original';

  const [students, setStudents] = useState<Student[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [userSections, setUserSections] = useState<UserSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSortMode, setStudentSortMode] = useState<'original' | 'roll_number' | 'name'>(effectiveSortOrder);
  const [sectionFilterId, setSectionFilterId] = useState('all');
  const [teacherDetailView, setTeacherDetailView] = useState<'none' | 'actions'>('none');

  const [addOpen, setAddOpen] = useState(false);
  const [addRoll, setAddRoll] = useState('');
  const [addName, setAddName] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [csvData, setCsvData] = useState<{ rollNumber: string; fullName: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editRoll, setEditRoll] = useState('');
  const [editName, setEditName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignStudent, setReassignStudent] = useState<Student | null>(null);
  const [reassignSectionId, setReassignSectionId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const isPrimaryTeacher = user?.role === 'primary_teacher';
  const isAdmin = user?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!user || !university) return;
    setLoading(true);
    try {
      const allSections = await db.sections
        .where('universityId')
        .equals(university.id)
        .toArray();
      setSections(allSections);

      let sectionIds: string[] = [];

      if (user.role === 'primary_teacher') {
        const us = await getUserSections(user.id);
        setUserSections(us);
        sectionIds = us.map((s) => s.sectionId);
      } else if (user.role === 'admin') {
        const deptSections = allSections.filter(
          (s) => s.departmentId === user.departmentId
        );
        sectionIds = deptSections.map((s) => s.id);
      } else if (user.role === 'cr') {
        const us = await getUserSections(user.id);
        setUserSections(us);
        sectionIds = us.map((s) => s.sectionId);
      } else if (user.role === 'regular_teacher') {
        const userSubjects = await db.userSubjects
          .where('userId')
          .equals(user.id)
          .toArray();
        sectionIds = [...new Set(userSubjects.map((us) => us.sectionId))];
      }

      const allStudents: Student[] = [];
      for (const sid of sectionIds) {
        const s = await getStudents(sid);
        allStudents.push(...s);
      }
      setStudents(allStudents);
    } catch (_err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Keep student list sorting deterministic now that direction toggle is removed.
    setSortDirection('asc');
  }, [setSortDirection]);

  useEffect(() => {
    setStudentSortMode(effectiveSortOrder);
  }, [effectiveSortOrder]);

  useEffect(() => {
    if (!user || !university) return;

    const sectionIds = [...new Set(students.map((s) => s.sectionId))];
    if (sectionIds.length === 0) return;

    const channels = sectionIds.map((sectionId) =>
      subscribeToStudents(sectionId, async () => {
        await pullFromCloud(university.id);
        await loadData();
      })
    );

    return () => {
      channels.forEach((channel) => channel.unsubscribe());
    };
  }, [user, university, students, loadData]);

  const filteredStudents = useMemo(() => {
    let list = students.filter((s) => s.isActive);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q)
      );
    }

    if (isAdmin && sectionFilterId !== 'all') {
      list = list.filter((s) => s.sectionId === sectionFilterId);
    }

    if (studentSortMode === 'name') {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (studentSortMode === 'roll_number') {
      list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
    } else {
      list.sort((a, b) => {
        const timeDiff = (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? '');
        return timeDiff !== 0 ? timeDiff : a.rollNumber.localeCompare(b.rollNumber);
      });
    }

    return list;
  }, [students, searchQuery, studentSortMode, isAdmin, sectionFilterId]);

  const studentRowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const virtualStudentRows = studentRowVirtualizer.getVirtualItems();

  const getSectionName = (sectionId: string) => {
    return sections.find((s) => s.id === sectionId)?.name ?? 'Unknown';
  };

  const primarySection = useMemo(() => {
    if (!isPrimaryTeacher || !user) return null;
    // First check user_sections table
    if (userSections.length > 0) {
      return sections.find((s) => s.id === userSections[0].sectionId) ?? null;
    }
    // Fallback: check sections where this user is the primary_teacher_id
    return sections.find((s) => s.primaryTeacherId === user.id) ?? null;
  }, [isPrimaryTeacher, user, userSections, sections]);

  const adminSectionOptions = useMemo(() => {
    if (!isAdmin || !user?.departmentId) return [];
    return sections
      .filter((s) => s.departmentId === user.departmentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, user?.departmentId, sections]);

  const showMobileActions = isPrimaryTeacher && teacherDetailView === 'actions';
  const mobileTemplateColumns = `${showMobileActions ? '5.25rem' : '6rem'} minmax(9.5rem, 1fr) 6.5rem${showMobileActions ? ' 2.5rem' : ''}`;

  async function handleAddStudent() {
    if (!user || !university) {
      toast.error('User or university not found');
      return;
    }
    if (!primarySection) {
      toast.error('No section assigned. Please contact admin.');
      return;
    }
    if (!addRoll.trim() || !addName.trim()) {
      toast.error('Both fields are required');
      return;
    }
    setAddSubmitting(true);
    try {
      const student: Student = {
        id: crypto.randomUUID(),
        universityId: university.id,
        departmentId: primarySection.departmentId,
        branchId: primarySection.branchId,
        specialisationId: primarySection.specialisationId,
        sectionId: primarySection.id,
        rollNumber: addRoll.trim(),
        fullName: addName.trim(),
        isActive: true,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
      };
      await createStudent(student, user.id);
      await logActivity({
        universityId: university.id,
        departmentId: primarySection.departmentId,
        actionType: 'student_edited',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: student.fullName,
        sectionName: primarySection.name,
      });
      toast.success('Student added');
      setAddOpen(false);
      setAddRoll('');
      setAddName('');
      loadData();
    } catch (_err) {
      toast.error('Failed to add student');
    } finally {
      setAddSubmitting(false);
    }
  }

  function handleFileParse(file: File) {
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const rows = results.data as Record<string, string>[];
        const parsed: { rollNumber: string; fullName: string }[] = [];
        for (const row of rows) {
          const rollNumber =
            row['roll_number'] || row['Roll Number'] || row['rollNumber'] || '';
          const fullName =
            row['full_name'] || row['Full Name'] || row['fullName'] || row['name'] || row['Name'] || '';
          if (rollNumber.trim() && fullName.trim()) {
            parsed.push({
              rollNumber: rollNumber.trim(),
              fullName: fullName.trim(),
            });
          }
        }
        if (parsed.length === 0) {
          toast.error('No valid rows found. Ensure columns "roll_number" and "full_name" exist.');
          return;
        }
        setCsvData(parsed);
      },
      error() {
        toast.error('Failed to parse file');
      },
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileParse(file);
  }

  async function handleBulkUpload() {
    if (!user || !university) {
      toast.error('User or university not found');
      return;
    }
    if (!primarySection) {
      toast.error('No section assigned. Please contact admin.');
      return;
    }
    if (csvData.length === 0) {
      toast.error('No CSV data to upload');
      return;
    }
    setUploadSubmitting(true);
    try {
      const baseUploadTs = Date.now();
      const newStudents: Student[] = csvData.map((row, index) => ({
        id: crypto.randomUUID(),
        universityId: university.id,
        departmentId: primarySection.departmentId,
        branchId: primarySection.branchId,
        specialisationId: primarySection.specialisationId,
        sectionId: primarySection.id,
        rollNumber: row.rollNumber,
        fullName: row.fullName,
        isActive: true,
        uploadedAt: new Date(baseUploadTs + index).toISOString(),
        uploadedBy: user.id,
      }));
      await createStudentsBulk(newStudents, user.id);
      await logActivity({
        universityId: university.id,
        departmentId: primarySection.departmentId,
        actionType: 'students_uploaded',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        sectionName: primarySection.name,
        details: { count: newStudents.length },
      });
      toast.success(`${newStudents.length} students uploaded`);
      setUploadOpen(false);
      setCsvData([]);
      setCsvFileName('');
      loadData();
    } catch (_err) {
      toast.error('Failed to upload students');
    } finally {
      setUploadSubmitting(false);
    }
  }

  function openEdit(student: Student) {
    setEditStudent(student);
    setEditRoll(student.rollNumber);
    setEditName(student.fullName);
    setEditOpen(true);
  }

  async function handleEditStudent() {
    if (!user || !university || !editStudent) return;
    if (!editRoll.trim() || !editName.trim()) {
      toast.error('Both fields are required');
      return;
    }
    setEditSubmitting(true);
    try {
      const updated: Student = {
        ...editStudent,
        rollNumber: editRoll.trim(),
        fullName: editName.trim(),
      };
      await updateStudent(updated, user.id);
      await logActivity({
        universityId: university.id,
        departmentId: editStudent.departmentId,
        actionType: 'student_edited',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: updated.fullName,
        sectionName: getSectionName(editStudent.sectionId),
      });
      toast.success('Student updated');
      setEditOpen(false);
      setEditStudent(null);
      loadData();
    } catch (_err) {
      toast.error('Failed to update student');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteStudent() {
    if (!user || !university || !deleteStudent) return;
    setDeleteSubmitting(true);
    try {
      await softDeleteStudent(deleteStudent.id, university.id, user.id);
      await logActivity({
        universityId: university.id,
        departmentId: deleteStudent.departmentId,
        actionType: 'student_edited',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: deleteStudent.fullName,
        sectionName: getSectionName(deleteStudent.sectionId),
        details: { action: 'soft_delete' },
      });
      toast.success('Student deactivated');
      setDeleteOpen(false);
      setDeleteStudent(null);
      loadData();
    } catch (_err) {
      toast.error('Failed to delete student');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function openReassign(student: Student) {
    setReassignStudent(student);
    setReassignSectionId('');
    setReassignOpen(true);
  }

  async function handleReassign() {
    if (!user || !university || !reassignStudent || !reassignSectionId) return;
    setReassignSubmitting(true);
    try {
      const targetSection = sections.find((s) => s.id === reassignSectionId);
      if (!targetSection) {
        toast.error('Section not found');
        return;
      }
      const updated: Student = {
        ...reassignStudent,
        sectionId: targetSection.id,
        departmentId: targetSection.departmentId,
        branchId: targetSection.branchId,
        specialisationId: targetSection.specialisationId,
      };
      await updateStudent(updated, user.id);
      await logActivity({
        universityId: university.id,
        departmentId: reassignStudent.departmentId,
        actionType: 'student_reassigned',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: reassignStudent.fullName,
        sectionName: targetSection.name,
        details: {
          fromSection: getSectionName(reassignStudent.sectionId),
          toSection: targetSection.name,
        },
      });
      toast.success(`Student reassigned to ${targetSection.name}`);
      setReassignOpen(false);
      setReassignStudent(null);
      loadData();
    } catch (_err) {
      toast.error('Failed to reassign student');
    } finally {
      setReassignSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Students</h1>
        {isPrimaryTeacher && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Upload Students
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add Student
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {isAdmin && (
            <Select
              value={sectionFilterId}
              onValueChange={(value) => {
                if (value !== null) {
                  setSectionFilterId(value);
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {adminSectionOptions.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={studentSortMode}
            onValueChange={(value) => {
              const next = value as 'original' | 'roll_number' | 'name';
              setStudentSortMode(next);
              setSortOrder(next);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original File</SelectItem>
              <SelectItem value="roll_number">Roll No.</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          {isPrimaryTeacher && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button
                type="button"
                variant={teacherDetailView === 'actions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setTeacherDetailView((prev) => (prev === 'actions' ? 'none' : 'actions'));
                }}
              >
                Mobile Action
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {searchQuery ? 'No students match your search.' : 'No students found.'}
        </div>
      ) : (
        <div ref={tableContainerRef} className="max-h-[65vh] overflow-auto rounded-md border">
          <div
            className="sticky top-0 z-10 grid border-b bg-background text-xs font-medium text-muted-foreground sm:hidden"
            style={{ gridTemplateColumns: mobileTemplateColumns }}
          >
            <div className="px-2 py-2">Roll No.</div>
            <div className="px-2 py-2">Full Name</div>
            <div className="px-2 py-2">Section</div>
            {showMobileActions && <div className="px-2 py-2 text-center">Action</div>}
          </div>
          <div
            className="sticky top-0 z-10 hidden border-b bg-background text-sm font-medium text-muted-foreground sm:grid"
            style={{
              gridTemplateColumns: isPrimaryTeacher
                ? '8.5rem minmax(12rem, 1.5fr) 8rem 9rem'
                : '8.5rem minmax(12rem, 1.5fr) 8rem',
            }}
          >
            <div className="px-2 py-2">Roll Number</div>
            <div className="px-2 py-2">Full Name</div>
            <div className="px-2 py-2">Section</div>
            {isPrimaryTeacher && <div className="px-2 py-2 text-right">Actions</div>}
          </div>
          <div
            style={{
              display: 'grid',
              height: `${studentRowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualStudentRows.map((virtualRow) => {
              const student = filteredStudents[virtualRow.index];
              if (!student) return null;

              return (
                <Fragment key={student.id}>
                  <div
                    className="grid items-center border-b px-0 transition-colors hover:bg-muted/50 sm:hidden"
                    style={{
                      gridTemplateColumns: mobileTemplateColumns,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="truncate px-2 py-2 font-mono text-xs">{student.rollNumber}</div>
                    <div className="truncate px-2 py-2 text-xs">{student.fullName}</div>
                    <div className="truncate px-2 py-2 text-xs">{getSectionName(student.sectionId)}</div>
                    {showMobileActions && (
                      <div className="px-1 py-2 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <MoreVertical className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(student)}>
                              <Pencil className="mr-2 size-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openReassign(student)}>
                              <ArrowRightLeft className="mr-2 size-3.5" />
                              Reassign
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteStudent(student);
                                setDeleteOpen(true);
                              }}
                              className="text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>

                  <div
                    className="hidden items-center border-b px-0 transition-colors hover:bg-muted/50 sm:grid"
                    style={{
                      gridTemplateColumns: isPrimaryTeacher
                        ? '8.5rem minmax(12rem, 1.5fr) 8rem 9rem'
                        : '8.5rem minmax(12rem, 1.5fr) 8rem',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-2 py-2 font-mono whitespace-nowrap">{student.rollNumber}</div>
                    <div className="truncate px-2 py-2">{student.fullName}</div>
                    <div className="truncate px-2 py-2">{getSectionName(student.sectionId)}</div>
                    {isPrimaryTeacher && (
                      <div className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEdit(student)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openReassign(student)}
                          >
                            <ArrowRightLeft className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setDeleteStudent(student);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Student Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Add a new student to {primarySection?.name ?? 'your section'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-roll">Roll Number</Label>
              <Input
                id="add-roll"
                value={addRoll}
                onChange={(e) => setAddRoll(e.target.value)}
                placeholder="e.g. 2024CS001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Full Name</Label>
              <Input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleAddStudent} disabled={addSubmitting}>
              {addSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Students Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setCsvData([]);
            setCsvFileName('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Students</DialogTitle>
            <DialogDescription>
              Upload a CSV file with &quot;roll_number&quot; and &quot;full_name&quot; columns.
            </DialogDescription>
          </DialogHeader>

          {csvData.length === 0 ? (
            <div
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a CSV file here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileParse(file);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {csvFileName} - {csvData.length} students found
                </p>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setCsvData([]);
                    setCsvFileName('');
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-[240px] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll Number</TableHead>
                      <TableHead>Full Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{row.rollNumber}</TableCell>
                        <TableCell>{row.fullName}</TableCell>
                      </TableRow>
                    ))}
                    {csvData.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          ...and {csvData.length - 50} more
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={handleBulkUpload}
              disabled={uploadSubmitting || csvData.length === 0}
            >
              {uploadSubmitting && <Loader2 className="size-4 animate-spin" />}
              Upload {csvData.length} Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-roll">Roll Number</Label>
              <Input
                id="edit-roll"
                value={editRoll}
                onChange={(e) => setEditRoll(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleEditStudent} disabled={editSubmitting}>
              {editSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">
                {deleteStudent?.fullName}
              </span>
              ? They will no longer appear in attendance lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteStudent}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting && <Loader2 className="size-4 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Student Dialog */}
      <Dialog
        open={reassignOpen}
        onOpenChange={(open) => {
          setReassignOpen(open);
          if (!open) setReassignStudent(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign Student</DialogTitle>
            <DialogDescription>
              Move{' '}
              <span className="font-medium text-foreground">
                {reassignStudent?.fullName}
              </span>{' '}
              to a different section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Target Section</Label>
            <Select
              value={reassignSectionId}
              onValueChange={(value) => { if (value !== null) setReassignSectionId(value); }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {sections
                  .filter(
                    (s) =>
                      s.isActive &&
                      !s.isArchived &&
                      s.id !== reassignStudent?.sectionId
                  )
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={handleReassign}
              disabled={reassignSubmitting || !reassignSectionId}
            >
              {reassignSubmitting && <Loader2 className="size-4 animate-spin" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
