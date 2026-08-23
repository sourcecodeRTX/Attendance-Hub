'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getSubjects, createSubject, deleteSubject, updateSubject } from '@/lib/db/subjects';
import { getUserSections } from '@/lib/db/user-sections';
import { logActivity } from '@/lib/db/activity';
import { db } from '@/lib/db/index';
import { applyRemoteChange } from '@/lib/db/sync';
import { subscribeToSubjects, REALTIME_REFRESH_DEBOUNCE_MS } from '@/lib/supabase/realtime';
import { debounce } from '@/lib/utils/debounce';
import { subjectSchema } from '@/lib/utils/validation';
import { getDepartments, getSections } from '@/lib/db/university';
import type { Subject, Section, Department } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, BookOpen, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SubjectsPage() {
  const { user, university } = useAuthStore();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [subjectSections, setSubjectSections] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Department and sections for multi-select
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDepartmentId, setCreateDepartmentId] = useState('');
  const [createSelectedSections, setCreateSelectedSections] = useState<string[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Edit subject state
  const [editOpen, setEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editSelectedSections, setEditSelectedSections] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubjectState, setDeleteSubjectState] = useState<Subject | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSessionCount, setDeleteSessionCount] = useState(0);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !university) return;

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load departments and sections
      const depts = user.role === 'super_admin' 
        ? await getDepartments(university.id)
        : user.departmentId 
        ? await db.departments.where('id').equals(user.departmentId).toArray()
        : [];
      setDepartments(depts);

      const secs = user.role === 'super_admin'
        ? await getSections(university.id)
        : user.departmentId
        ? await getSections(university.id, user.departmentId)
        : [];
      setAllSections(secs.filter(s => s.isActive && !s.isArchived));

      // Admin can see all subjects in their department
      const subjectList = await db.subjects
        .where('universityId')
        .equals(university.id)
        .toArray();
      setSubjects(subjectList);

      const counts: Record<string, number> = {};
      const sectionsMap: Record<string, string[]> = {};
      
      for (const sub of subjectList) {
        const count = await db.attendanceSessions
          .where('subjectId')
          .equals(sub.id)
          .count();
        counts[sub.id] = count;
        
        // Get section IDs for this subject
        const subjectSecs = await db.subjectSections
          .where('subjectId')
          .equals(sub.id)
          .toArray();
        sectionsMap[sub.id] = subjectSecs.map(ss => ss.sectionId);
      }
      
      setSessionCounts(counts);
      setSubjectSections(sectionsMap);
    } catch (_err) {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!university) return;

    // Subscribe to subjects changes (admin can see all). Realtime events
    // apply their changed row directly into Dexie and debounce the local
    // re-read — never a full pullFromCloud (F-019).
    const refresh = debounce(() => {
      void loadData();
    }, REALTIME_REFRESH_DEBOUNCE_MS);

    const channel = subscribeToSubjects('*', (payload) => {
      void applyRemoteChange('subjects', payload.eventType, payload.new as any, payload.old as any);
      refresh();
    });

    return () => {
      channel.unsubscribe();
      refresh.cancel();
    };
  }, [university, loadData]);

  async function handleCreateSubject() {
    if (!user || !university) return;

    setCreateErrors({});
    
    // Validate inputs
    const errors: Record<string, string> = {};
    const result = subjectSchema.safeParse({
      name: createName.trim(),
      code: createCode.trim(),
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errors[key]) errors[key] = issue.message;
      }
    }
    
    if (!createDepartmentId) {
      errors.department = 'Please select a department';
    }
    
    if (createSelectedSections.length === 0) {
      errors.sections = 'Please select at least one section';
    }
    
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setCreateSubmitting(true);
    try {
      const subjectId = crypto.randomUUID();
      const subject: Subject = {
        id: subjectId,
        universityId: university.id,
        departmentId: createDepartmentId,
        sectionId: '', // Will be removed - keeping for backward compatibility
        name: createName.trim(),
        code: createCode.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };
      
      await createSubject(subject, createSelectedSections, user.id);
      
      await logActivity({
        universityId: university.id,
        departmentId: createDepartmentId,
        actionType: 'subject_created',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: subject.name,
        sectionName: null,
        details: { sectionCount: createSelectedSections.length },
      });
      
      toast.success(`Subject "${subject.name}" created and assigned to ${createSelectedSections.length} section(s)`);
      setCreateOpen(false);
      setCreateName('');
      setCreateCode('');
      setCreateDepartmentId('');
      setCreateSelectedSections([]);
      setCreateErrors({});
      loadData();
    } catch (_err) {
      toast.error('Failed to create subject');
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openDeleteDialog(subject: Subject) {
    setDeleteSubjectState(subject);
    setDeleteConfirmText('');
    setDeleteSessionCount(sessionCounts[subject.id] ?? 0);
    setDeleteOpen(true);
  }

  async function handleDeleteSubject() {
    if (!user || !university || !deleteSubjectState) return;

    if (deleteConfirmText !== deleteSubjectState.name) {
      toast.error('Confirmation text does not match');
      return;
    }

    setDeleteSubmitting(true);
    try {
      // Get section names for this subject before deletion
      const sectionIds = subjectSections[deleteSubjectState.id] ?? [];
      const sectionNames = sectionIds
        .map(id => allSections.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      
      await deleteSubject(deleteSubjectState.id, university.id, user.id);
      await logActivity({
        universityId: university.id,
        departmentId: deleteSubjectState.departmentId,
        actionType: 'subject_deleted',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: deleteSubjectState.name,
        sectionName: sectionNames || null,
        details: { sessionsDeleted: deleteSessionCount },
      });
      toast.success(`Subject "${deleteSubjectState.name}" deleted`);
      setDeleteOpen(false);
      setDeleteSubjectState(null);
      loadData();
    } catch (_err) {
      toast.error('Failed to delete subject');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function openEditDialog(subject: Subject) {
    setEditSubject(subject);
    setEditName(subject.name);
    setEditCode(subject.code);
    setEditSelectedSections(subjectSections[subject.id] ?? []);
    setEditErrors({});
    setEditOpen(true);
  }

  async function handleEditSubject() {
    if (!user || !university || !editSubject) return;

    setEditErrors({});
    
    const errors: Record<string, string> = {};
    const result = subjectSchema.safeParse({
      name: editName.trim(),
      code: editCode.trim(),
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errors[key]) errors[key] = issue.message;
      }
    }
    
    if (editSelectedSections.length === 0) {
      errors.sections = 'Please select at least one section';
    }
    
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setEditSubmitting(true);
    try {
      const updatedSubject: Subject = {
        ...editSubject,
        name: editName.trim(),
        code: editCode.trim(),
      };
      
      await updateSubject(updatedSubject, editSelectedSections, user.id);
      
      await logActivity({
        universityId: university.id,
        departmentId: editSubject.departmentId,
        actionType: 'subject_updated',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: updatedSubject.name,
        sectionName: null,
        details: { sectionCount: editSelectedSections.length },
      });
      
      toast.success(`Subject "${updatedSubject.name}" updated`);
      setEditOpen(false);
      setEditSubject(null);
      loadData();
    } catch (_err) {
      toast.error('Failed to update subject');
    } finally {
      setEditSubmitting(false);
    }
  }

  if (!user) return null;

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="py-12 text-center text-muted-foreground">
        You do not have permission to manage subjects. Only admins can create and manage subjects.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subjects</h1>
          <p className="text-sm text-muted-foreground">
            Manage subjects across all departments
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create Subject
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="mb-2 size-10" />
          <p>No subjects yet. Create your first subject.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((subject) => {
              const sectionIds = subjectSections[subject.id] ?? [];
              const sectionNames = sectionIds
                .map(id => allSections.find(s => s.id === id)?.name)
                .filter(Boolean);
              
              return (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell className="font-mono">{subject.code}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {sectionNames.length > 0 ? (
                        sectionNames.map((name, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No sections</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(subject.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{sessionCounts[subject.id] ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit subject ${subject.name}`}
                        onClick={() => openEditDialog(subject)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete subject ${subject.name}`}
                        onClick={() => openDeleteDialog(subject)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Create Subject Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateName('');
            setCreateCode('');
            setCreateDepartmentId('');
            setCreateSelectedSections([]);
            setCreateErrors({});
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Create Subject</DialogTitle>
              <HelpTooltip content={HELP_TOOLTIPS.subjectCreate} />
            </div>
            <DialogDescription>
              Add a new subject and assign it to sections.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateSubject();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="subject-name">Subject Name</Label>
              <Input
                id="subject-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Data Structures"
                aria-invalid={!!createErrors.name}
                aria-describedby={createErrors.name ? 'subject-name-error' : undefined}
              />
              {createErrors.name && (
                <p id="subject-name-error" role="alert" className="text-xs text-destructive">{createErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-code">Subject Code</Label>
              <Input
                id="subject-code"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="e.g. CS201"
                aria-invalid={!!createErrors.code}
                aria-describedby={createErrors.code ? 'subject-code-error' : undefined}
              />
              {createErrors.code && (
                <p id="subject-code-error" role="alert" className="text-xs text-destructive">{createErrors.code}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Select value={createDepartmentId} onValueChange={(v) => { if (v) setCreateDepartmentId(v); }}>
                <SelectTrigger
                  id="department"
                  aria-invalid={!!createErrors.department}
                  aria-describedby={createErrors.department ? 'department-error' : undefined}
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.department && (
                <p id="department-error" role="alert" className="text-xs text-destructive">{createErrors.department}</p>
              )}
            </div>
            {createDepartmentId && (
              <div className="space-y-1.5">
                <Label>Sections (select at least one)</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-2">
                  {allSections
                    .filter((s) => s.departmentId === createDepartmentId)
                    .map((section) => (
                      <div key={section.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`section-${section.id}`}
                          checked={createSelectedSections.includes(section.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCreateSelectedSections([...createSelectedSections, section.id]);
                            } else {
                              setCreateSelectedSections(
                                createSelectedSections.filter((id) => id !== section.id)
                              );
                            }
                          }}
                        />
                        <Label htmlFor={`section-${section.id}`} className="font-normal cursor-pointer">
                          {section.name}
                        </Label>
                      </div>
                    ))}
                </div>
                {createErrors.sections && (
                  <p id="create-sections-error" role="alert" className="text-xs text-destructive">{createErrors.sections}</p>
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={createSubmitting}>
                {createSubmitting && <Loader2 className="size-4 animate-spin" />}
                Create Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditSubject(null);
            setEditName('');
            setEditCode('');
            setEditSelectedSections([]);
            setEditErrors({});
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update subject details and section assignments.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditSubject();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-subject-name">Subject Name</Label>
              <Input
                id="edit-subject-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Data Structures"
                aria-invalid={!!editErrors.name}
                aria-describedby={editErrors.name ? 'edit-subject-name-error' : undefined}
              />
              {editErrors.name && (
                <p id="edit-subject-name-error" role="alert" className="text-xs text-destructive">{editErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-subject-code">Subject Code</Label>
              <Input
                id="edit-subject-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="e.g. CS201"
                aria-invalid={!!editErrors.code}
                aria-describedby={editErrors.code ? 'edit-subject-code-error' : undefined}
              />
              {editErrors.code && (
                <p id="edit-subject-code-error" role="alert" className="text-xs text-destructive">{editErrors.code}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sections (select at least one)</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-2">
                {allSections
                  .filter((s) => s.departmentId === editSubject?.departmentId)
                  .map((section) => (
                    <div key={section.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-section-${section.id}`}
                        checked={editSelectedSections.includes(section.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditSelectedSections([...editSelectedSections, section.id]);
                          } else {
                            setEditSelectedSections(
                              editSelectedSections.filter((id) => id !== section.id)
                            );
                          }
                        }}
                      />
                      <Label htmlFor={`edit-section-${section.id}`} className="font-normal cursor-pointer">
                        {section.name}
                      </Label>
                    </div>
                  ))}
              </div>
              {editErrors.sections && (
                <p id="edit-sections-error" role="alert" className="text-xs text-destructive">{editErrors.sections}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteSubjectState(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              subject{' '}
              <span className="font-semibold text-foreground">
                {deleteSubjectState?.name}
              </span>{' '}
              and{' '}
              <span className="font-semibold text-destructive">
                {deleteSessionCount} attendance session
                {deleteSessionCount !== 1 ? 's' : ''}
              </span>{' '}
              associated with it.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDeleteSubject();
            }}
            className="space-y-1.5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">
                Type{' '}
                <span className="font-semibold">{deleteSubjectState?.name}</span>{' '}
                to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteSubjectState?.name}
              />
            </div>
            <DialogFooter className="pt-3">
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                variant="destructive"
                type="submit"
                disabled={
                  deleteSubmitting ||
                  deleteConfirmText !== deleteSubjectState?.name
                }
              >
                {deleteSubmitting && <Loader2 className="size-4 animate-spin" />}
                Delete Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
