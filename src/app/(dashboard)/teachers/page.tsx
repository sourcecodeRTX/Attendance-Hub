'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Copy, Pencil, Trash2, X, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getSections } from '@/lib/db/university';
import { createUserSubject, deleteUserSectionsByUser, updateUserRole, deleteUserSubject } from '@/lib/db/user-sections';
import { logActivity } from '@/lib/db/activity';
import { createManagedAuthUser } from '../actions';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import { teacherAccountSchema } from '@/lib/utils/validation';
import type { User, Section, Subject, UserSubject, UserSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { HelpTooltip, HELP_TOOLTIPS } from '@/components/ui/help-tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const createTeacherFormSchema = teacherAccountSchema.extend({
  role: z.enum(['primary_teacher', 'regular_teacher']),
});
type CreateTeacherFormData = z.infer<typeof createTeacherFormSchema>;

const ROLE_LABELS: Record<string, string> = {
  primary_teacher: 'Primary Teacher',
  regular_teacher: 'Regular Teacher',
};

export default function TeachersPage() {
  const { user, university } = useAuthStore();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userSections, setUserSections] = useState<UserSection[]>([]);
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // New assignment workflow state
  const [assignTeacherId, setAssignTeacherId] = useState<string>('');
  const [assignSubjectId, setAssignSubjectId] = useState<string>('');
  const [subjectSectionsMap, setSubjectSectionsMap] = useState<Record<string, string[]>>({});
  const [pendingAssignments, setPendingAssignments] = useState<Array<{
    subjectId: string;
    sectionIds: string[];
  }>>([]);
  const [contextualMenuOpen, setContextualMenuOpen] = useState(false);
  const [selectedSectionsForSubject, setSelectedSectionsForSubject] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Edit role state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<'primary_teacher' | 'regular_teacher'>('regular_teacher');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const form = useForm<CreateTeacherFormData>({
    resolver: zodResolver(createTeacherFormSchema),
    defaultValues: {
      fullName: '',
      staffId: '',
      email: '',
      role: 'regular_teacher',
    },
  });

  const loadData = useCallback(async () => {
    if (!user || !university || !user.departmentId) return;
    try {
      const [sectionData, teacherUsers, allSubjects, allUserSections, allUserSubjects, allSubjectSections] = await Promise.all([
        getSections(university.id, user.departmentId),
        db.users
          .where('universityId')
          .equals(university.id)
          .filter(
            (u) =>
              u.departmentId === user.departmentId &&
              (u.role === 'primary_teacher' || u.role === 'regular_teacher')
          )
          .toArray(),
        db.subjects
          .where('universityId')
          .equals(university.id)
          .filter((s) => s.departmentId === user.departmentId)
          .toArray(),
        db.userSections
          .where('universityId')
          .equals(university.id)
          .toArray(),
        db.userSubjects
          .where('universityId')
          .equals(university.id)
          .toArray(),
        db.subjectSections.toArray(),
      ]);

      setSections(sectionData);
      setTeachers(teacherUsers);
      setSubjects(allSubjects);
      setUserSections(allUserSections);
      setUserSubjects(allUserSubjects);
      
      // Build subject -> sections mapping
      const sectionsMap: Record<string, string[]> = {};
      for (const ss of allSubjectSections) {
        if (!sectionsMap[ss.subjectId]) {
          sectionsMap[ss.subjectId] = [];
        }
        sectionsMap[ss.subjectId].push(ss.sectionId);
      }
      setSubjectSectionsMap(sectionsMap);
    } catch {
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, `${s.name} (${s.code})`]));

  const filteredTeachers = teachers.filter(
    (t) =>
      t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTeacherSectionCount = (teacherId: string) =>
    userSections.filter((us) => us.userId === teacherId).length;

  const getTeacherSubjectCount = (teacherId: string) =>
    userSubjects.filter((us) => us.userId === teacherId).length;

  // All active teachers (primary + regular) for assignment dropdown
  const allActiveTeachers = teachers.filter((t) => t.isActive);

  // All current assignments
  const currentAssignments = userSubjects;

  // Get sections available for a subject (excluding those already assigned to other teachers)
  const getAvailableSectionsForSubject = (subjectId: string, selectedTeacherId: string) => {
    const subjectSectionIds = subjectSectionsMap[subjectId] ?? [];
    
    // Get sections already assigned to OTHER teachers for this subject
    const assignedSectionIds = userSubjects
      .filter((us) => us.subjectId === subjectId && us.userId !== selectedTeacherId)
      .map((us) => us.sectionId);
    
    // Also exclude sections that are in pending assignments for this subject
    const pendingForSubject = pendingAssignments.find(p => p.subjectId === subjectId);
    const pendingSectionIds = pendingForSubject?.sectionIds ?? [];
    
    // Return sections that are linked to this subject and not already assigned to another teacher
    return sections.filter(
      (s) => 
        subjectSectionIds.includes(s.id) && 
        !assignedSectionIds.includes(s.id) &&
        !pendingSectionIds.includes(s.id)
    );
  };

  // Handle opening contextual menu when subject is selected
  const handleSelectSubjectForAssignment = (subjectId: string) => {
    setAssignSubjectId(subjectId);
    setSelectedSectionsForSubject([]);
    setContextualMenuOpen(true);
  };

  // Handle completing section selection for current subject
  const handleDoneSectionSelection = () => {
    if (selectedSectionsForSubject.length === 0) {
      setContextualMenuOpen(false);
      setAssignSubjectId('');
      return;
    }
    
    // Add to pending assignments
    setPendingAssignments((prev) => {
      const existing = prev.find(p => p.subjectId === assignSubjectId);
      if (existing) {
        return prev.map(p => 
          p.subjectId === assignSubjectId 
            ? { ...p, sectionIds: [...p.sectionIds, ...selectedSectionsForSubject] }
            : p
        );
      }
      return [...prev, { subjectId: assignSubjectId, sectionIds: selectedSectionsForSubject }];
    });
    
    setContextualMenuOpen(false);
    setAssignSubjectId('');
    setSelectedSectionsForSubject([]);
  };

  // Remove a pending assignment
  const handleRemovePendingAssignment = (subjectId: string, sectionId: string) => {
    setPendingAssignments((prev) => {
      return prev.map(p => {
        if (p.subjectId === subjectId) {
          const newSectionIds = p.sectionIds.filter(id => id !== sectionId);
          return { ...p, sectionIds: newSectionIds };
        }
        return p;
      }).filter(p => p.sectionIds.length > 0);
    });
  };

  // Submit all pending assignments
  const handleSubmitAssignments = async () => {
    if (!user || !university || !assignTeacherId || pendingAssignments.length === 0) return;
    
    setAssigning(true);
    try {
      const teacher = teachers.find((t) => t.id === assignTeacherId);
      
      for (const assignment of pendingAssignments) {
        for (const sectionId of assignment.sectionIds) {
          await createUserSubject(
            {
              id: crypto.randomUUID(),
              universityId: university.id,
              userId: assignTeacherId,
              subjectId: assignment.subjectId,
              sectionId: sectionId,
              assignedAt: new Date().toISOString(),
              assignedBy: user.id,
            },
            user.id
          );
        }
      }

      await logActivity({
        universityId: university.id,
        departmentId: user.departmentId,
        actionType: 'teacher_subjects_assigned',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: teacher?.fullName,
        sectionName: null,
        details: { 
          assignmentCount: pendingAssignments.reduce((acc, p) => acc + p.sectionIds.length, 0),
        },
      });

      toast.success(`Assigned ${pendingAssignments.reduce((acc, p) => acc + p.sectionIds.length, 0)} subject-section combination(s) to ${teacher?.fullName}`);
      setAssignTeacherId('');
      setPendingAssignments([]);
      await loadData();
    } catch {
      toast.error('Failed to submit assignments');
    } finally {
      setAssigning(false);
    }
  };

  // Handle removing an existing assignment
  const handleRemoveExistingAssignment = async (assignmentId: string) => {
    if (!user || !university) return;
    
    try {
      const assignment = userSubjects.find(us => us.id === assignmentId);
      if (!assignment) return;
      
      const teacher = teachers.find(t => t.id === assignment.userId);
      const subject = subjects.find(s => s.id === assignment.subjectId);
      const section = sections.find(s => s.id === assignment.sectionId);
      
      await deleteUserSubject(assignmentId, university.id, user.id);
      
      await logActivity({
        universityId: university.id,
        departmentId: user.departmentId,
        actionType: 'teacher_subject_removed',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: teacher?.fullName,
        sectionName: section?.name,
        details: { subject: subject?.name },
      });
      
      toast.success('Assignment removed');
      await loadData();
    } catch {
      toast.error('Failed to remove assignment');
    }
  };

  // Reset assignment form when teacher changes
  const handleTeacherChange = (teacherId: string) => {
    setAssignTeacherId(teacherId);
    setPendingAssignments([]);
    setAssignSubjectId('');
    setContextualMenuOpen(false);
    setSelectedSectionsForSubject([]);
  };

  const handleCreateTeacher = form.handleSubmit(async (data) => {
    if (!user || !university || !user.departmentId) return;
    setSubmitting(true);
    try {
      const tempPassword = `Temp-${crypto.randomUUID().slice(0, 8)}`;

      const managedAuth = await createManagedAuthUser({
        email: data.email,
        password: tempPassword,
      });
      if (!managedAuth.success || !managedAuth.userId) {
        throw new Error(managedAuth.error || 'Failed to create auth user');
      }

      const authUserId = managedAuth.userId;
      const now = new Date().toISOString();

      const { error: userError } = await supabase.from('users').insert({
        id: authUserId,
        university_id: university.id,
        role: data.role,
        full_name: data.fullName,
        staff_id: data.staffId,
        email: data.email,
        department_id: user.departmentId,
        is_active: true,
        must_change_password: true,
        created_at: now,
        created_by: user.id,
      });
      if (userError) throw new Error(userError.message);

      const newUser: User = {
        id: authUserId,
        universityId: university.id,
        role: data.role,
        fullName: data.fullName,
        staffId: data.staffId,
        email: data.email,
        departmentId: user.departmentId,
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        createdBy: user.id,
      };
      await db.users.put(newUser);

      await logActivity({
        universityId: university.id,
        departmentId: user.departmentId,
        actionType: 'account_created',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: data.fullName,
        details: { role: data.role, email: data.email },
      });

      setTempCredentials({ email: data.email, password: tempPassword });
      setIsCreateOpen(false);
      setIsCredentialsOpen(true);
      form.reset();
      toast.success('Teacher account created successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create teacher';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const handleOpenEditDialog = (teacher: User) => {
    setEditingTeacher(teacher);
    setEditRole(teacher.role as 'primary_teacher' | 'regular_teacher');
    setIsEditOpen(true);
  };

  const handleEditTeacherRole = async () => {
    if (!user || !university || !editingTeacher) return;
    if (editRole === editingTeacher.role) {
      setIsEditOpen(false);
      return;
    }

    setEditSubmitting(true);
    try {
      const oldRole = editingTeacher.role;

      // Update user role
      await updateUserRole(editingTeacher.id, university.id, editRole, user.id);

      // If demoting from primary_teacher to regular_teacher, remove section assignments
      if (oldRole === 'primary_teacher' && editRole === 'regular_teacher') {
        await deleteUserSectionsByUser(editingTeacher.id, university.id, user.id);
      }

      // Log activity
      await logActivity({
        universityId: university.id,
        departmentId: user.departmentId,
        actionType: 'teacher_role_changed',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: editingTeacher.fullName,
        details: { 
          oldRole: ROLE_LABELS[oldRole] ?? oldRole, 
          newRole: ROLE_LABELS[editRole] ?? editRole,
        },
      });

      setIsEditOpen(false);
      setEditingTeacher(null);
      toast.success(`Role updated to ${ROLE_LABELS[editRole]}`);
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update teacher role';
      toast.error(message);
    } finally {
      setEditSubmitting(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teachers</h1>
        <p className="text-sm text-muted-foreground">
          Manage teacher accounts, subjects, and section assignments
        </p>
      </div>

      <Tabs defaultValue="teachers">
        <TabsList>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="assignments">Subject & Section Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers">
          <div className="space-y-4 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search teachers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" data-icon="inline-start" />
                Create Teacher
              </Button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading teachers...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {searchQuery
                  ? 'No teachers match your search'
                  : 'No teachers created yet'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Staff ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sections / Subjects</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium">
                          {teacher.fullName}
                        </TableCell>
                        <TableCell>{teacher.staffId}</TableCell>
                        <TableCell>{teacher.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ROLE_LABELS[teacher.role] ?? teacher.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getTeacherSectionCount(teacher.id)} /{' '}
                          {getTeacherSubjectCount(teacher.id)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              teacher.isActive ? 'default' : 'destructive'
                            }
                          >
                            {teacher.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEditDialog(teacher)}
                            title="Edit role"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <div className="space-y-6 pt-4">
            {/* Assignment Form */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Assign Subjects & Sections to Teacher</h3>
                <HelpTooltip content={HELP_TOOLTIPS.teacherAssignment} />
              </div>
              
              {/* Step 1: Select Teacher */}
              <div className="space-y-1.5">
                <Label>Teacher (Primary or Regular)</Label>
                <Select
                  value={assignTeacherId}
                  onValueChange={(v) => { if (v) handleTeacherChange(v); }}
                >
                  <SelectTrigger className="w-full sm:max-w-sm">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {allActiveTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.fullName} ({ROLE_LABELS[t.role]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Select Subject (only shown after teacher selected) */}
              {assignTeacherId && (
                <div className="space-y-1.5">
                  <Label>Select Subject</Label>
                  <Select
                    value={assignSubjectId}
                    onValueChange={(v) => { if (v) handleSelectSubjectForAssignment(v); }}
                    disabled={contextualMenuOpen}
                  >
                    <SelectTrigger className="w-full sm:max-w-sm">
                      <SelectValue placeholder="Select a subject to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 3: Contextual Menu - Section Selection */}
              {contextualMenuOpen && assignSubjectId && (
                <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Select Sections for: {subjects.find(s => s.id === assignSubjectId)?.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setContextualMenuOpen(false);
                        setAssignSubjectId('');
                        setSelectedSectionsForSubject([]);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  
                  {(() => {
                    const availableSections = getAvailableSectionsForSubject(assignSubjectId, assignTeacherId);
                    
                    if (availableSections.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No sections available. All sections for this subject are either already assigned to other teachers or pending assignment.
                        </p>
                      );
                    }
                    
                    return (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {availableSections.map((section) => (
                          <div key={section.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`section-assign-${section.id}`}
                              checked={selectedSectionsForSubject.includes(section.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSectionsForSubject([...selectedSectionsForSubject, section.id]);
                                } else {
                                  setSelectedSectionsForSubject(
                                    selectedSectionsForSubject.filter((id) => id !== section.id)
                                  );
                                }
                              }}
                            />
                            <Label htmlFor={`section-assign-${section.id}`} className="font-normal cursor-pointer">
                              {section.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  
                  <Button
                    size="sm"
                    onClick={handleDoneSectionSelection}
                    disabled={selectedSectionsForSubject.length === 0}
                  >
                    <Check className="size-4" />
                    Done
                  </Button>
                </div>
              )}

              {/* Pending Assignments Preview */}
              {pendingAssignments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Pending Assignments:</h4>
                  <div className="flex flex-wrap gap-2">
                    {pendingAssignments.flatMap((pa) =>
                      pa.sectionIds.map((sectionId) => {
                        const subject = subjects.find(s => s.id === pa.subjectId);
                        const section = sections.find(s => s.id === sectionId);
                        return (
                          <Badge key={`${pa.subjectId}-${sectionId}`} variant="secondary" className="gap-1">
                            {subject?.code} - {section?.name}
                            <button
                              type="button"
                              onClick={() => handleRemovePendingAssignment(pa.subjectId, sectionId)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              {pendingAssignments.length > 0 && (
                <Button
                  onClick={handleSubmitAssignments}
                  disabled={assigning}
                >
                  {assigning ? 'Submitting...' : `Submit ${pendingAssignments.reduce((acc, p) => acc + p.sectionIds.length, 0)} Assignment(s)`}
                </Button>
              )}
            </div>

            <Separator />

            {/* Current Assignments List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Current Assignments</h3>
              {currentAssignments.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  No subject assignments yet
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Assigned At</TableHead>
                        <TableHead className="w-16">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAssignments.map((assignment) => {
                        const teacher = teachers.find(
                          (t) => t.id === assignment.userId
                        );
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {teacher?.fullName ?? 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {ROLE_LABELS[teacher?.role ?? ''] ?? teacher?.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {subjectMap.get(assignment.subjectId) ?? assignment.subjectId}
                            </TableCell>
                            <TableCell>
                              {sectionMap.get(assignment.sectionId) ?? 'Unknown'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(
                                assignment.assignedAt
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleRemoveExistingAssignment(assignment.id)}
                                title="Remove assignment"
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Teacher Account</DialogTitle>
            <DialogDescription>
              Create a new teacher account with temporary credentials.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeacher} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="teacher-name">Full Name</Label>
              <Input
                id="teacher-name"
                placeholder="Teacher full name"
                {...form.register('fullName')}
              />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-staffid">Staff ID</Label>
              <Input
                id="teacher-staffid"
                placeholder="e.g. TCH001"
                {...form.register('staffId')}
              />
              {form.formState.errors.staffId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.staffId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-email">Email</Label>
              <Input
                id="teacher-email"
                type="email"
                placeholder="teacher@university.edu"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Role</Label>
                <HelpTooltip content={HELP_TOOLTIPS.teacherRole} />
              </div>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary_teacher">
                        Primary Teacher
                      </SelectItem>
                      <SelectItem value="regular_teacher">
                        Regular Teacher
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.role && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teacher Account Created</DialogTitle>
            <DialogDescription>
              Share these temporary credentials with the teacher. They must
              change their password on first login.
            </DialogDescription>
          </DialogHeader>
          {tempCredentials && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{tempCredentials.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Temporary Password
                </p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    {tempCredentials.password}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(tempCredentials.password);
                      toast.success('Password copied to clipboard');
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsCredentialsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Teacher Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingTeacher?.fullName}.
              {editingTeacher?.role === 'primary_teacher' && editRole === 'regular_teacher' && (
                <span className="mt-2 block text-amber-600 dark:text-amber-500">
                  Warning: Changing to Regular Teacher will remove all section assignments.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Role</Label>
                <HelpTooltip content={HELP_TOOLTIPS.teacherRole} />
              </div>
              <Select
                value={editRole}
                onValueChange={(val) => setEditRole(val as 'primary_teacher' | 'regular_teacher')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary_teacher">
                    Primary Teacher
                  </SelectItem>
                  <SelectItem value="regular_teacher">
                    Regular Teacher
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingTeacher?.role === 'regular_teacher' && editRole === 'primary_teacher' && (
              <p className="text-sm text-muted-foreground">
                After changing to Primary Teacher, you will need to assign them to sections separately.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditOpen(false)}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditTeacherRole} 
              disabled={editSubmitting || editRole === editingTeacher?.role}
            >
              {editSubmitting ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
