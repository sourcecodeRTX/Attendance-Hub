'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  getBranches,
  getSpecialisations,
  getSections,
  createSection,
  deleteSection,
  updateSection,
} from '@/lib/db/university';
import { createUserSection, deleteUserSectionsByUser } from '@/lib/db/user-sections';
import { logActivity } from '@/lib/db/activity';
import { db } from '@/lib/db';
import { sectionSchema, type SectionInput } from '@/lib/utils/validation';
import type { Branch, Specialisation, Section, User, UserSection, UserSubject } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

export default function SectionsPage() {
  const { user, university } = useAuthStore();
  const [sections, setSections] = useState<Section[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [specialisations, setSpecialisations] = useState<Specialisation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([]);
  const [userSections, setUserSections] = useState<UserSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<SectionInput>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      name: '',
      specialisationId: '',
    },
  });



  const loadData = useCallback(async () => {
    if (!user || !university || !user.departmentId) return;
    try {
      const [sectionData, branchData, specData, usersData, userSubjectsData, userSectionsData] = await Promise.all([
        getSections(university.id, user.departmentId),
        getBranches(university.id, user.departmentId),
        getSpecialisations(university.id),
        db.users.where('universityId').equals(university.id).toArray(),
        db.userSubjects.where('universityId').equals(university.id).toArray(),
        db.userSections.where('universityId').equals(university.id).toArray(),
      ]);

      const deptSpecs = specData.filter(
        (s) => s.departmentId === user.departmentId
      );

      setSections(sectionData);
      setBranches(branchData);
      setSpecialisations(deptSpecs);
      setUsers(usersData);
      setUserSubjects(userSubjectsData);
      setUserSections(userSectionsData);
    } catch {
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const specMap = new Map(specialisations.map((s) => [s.id, s.name]));
  const teacherMap = new Map(users.map((u) => [u.id, u.fullName]));

  const filteredSections = sections.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = form.handleSubmit(async (data) => {
    if (!user || !university || !user.departmentId) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const sectionId = crypto.randomUUID();

      // Get the selected specialisation to derive branchId
      const selectedSpec = specialisations.find(s => s.id === data.specialisationId);
      if (!selectedSpec) {
        toast.error('Invalid specialisation selected');
        setSubmitting(false);
        return;
      }

      const newSection: Section = {
        id: sectionId,
        universityId: university.id,
        departmentId: user.departmentId,
        branchId: selectedSpec.branchId, // Auto-derived from specialisation
        specialisationId: data.specialisationId,
        name: data.name,
        primaryTeacherId: null,
        isActive: true,
        isArchived: false,
        createdAt: now,
        createdBy: user.id,
      };
      await createSection(newSection, user.id);

      await logActivity({
        universityId: university.id,
        departmentId: user.departmentId,
        actionType: 'section_created',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: data.name,
        branchName: branchMap.get(selectedSpec.branchId),
        details: { specialisation: specMap.get(data.specialisationId) },
      });

      setIsCreateOpen(false);
      form.reset();
      toast.success('Section created successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create section';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const handleDelete = async (section: Section) => {
    if (!user || !university) return;

    const activeStudents = await db.students
      .where('sectionId')
      .equals(section.id)
      .filter((s) => s.isActive)
      .count();

    if (activeStudents > 0) {
      toast.error(
        `Cannot delete: section has ${activeStudents} active student(s)`
      );
      return;
    }

    setDeletingId(section.id);
    try {
      await deleteSection(section.id, university.id, user.id);

      await logActivity({
        universityId: university.id,
        departmentId: user.departmentId,
        actionType: 'section_deleted',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: section.name,
        branchName: branchMap.get(section.branchId),
      });

      toast.success('Section deleted');
      await loadData();
    } catch {
      toast.error('Failed to delete section');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Sections</h1>
            <HelpTooltip content={HELP_TOOLTIPS.section} />
          </div>
          <p className="text-sm text-muted-foreground">
            Manage sections within your department
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Create Section
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading sections...
        </div>
      ) : filteredSections.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {searchQuery
            ? 'No sections match your search'
            : 'No sections created yet'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Specialisation</TableHead>
              <TableHead>Assigned Teacher(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSections.map((section) => (
              <TableRow key={section.id}>
                <TableCell className="font-medium">{section.name}</TableCell>
                <TableCell>
                  {branchMap.get(section.branchId) ?? 'Unknown'}
                </TableCell>
                <TableCell>
                  {specMap.get(section.specialisationId) ?? 'Unknown'}
                </TableCell>
                <TableCell>
                  {(() => {
                    const teacherIds = new Set([
                      ...userSubjects.filter(us => us.sectionId === section.id).map(us => us.userId),
                      ...userSections.filter(us => us.sectionId === section.id).map(us => us.userId),
                      ...(section.primaryTeacherId ? [section.primaryTeacherId] : [])
                    ]);
                    if (teacherIds.size === 0) return <span className="text-muted-foreground">Unassigned</span>;
                    return Array.from(teacherIds)
                      .map(id => teacherMap.get(id) || 'Unknown')
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(', ');
                  })()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={section.isActive ? 'default' : 'destructive'}
                  >
                    {section.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingId === section.id}
                    onClick={() => handleDelete(section)}
                  >
                    <Trash2 className="size-3.5" data-icon="inline-start" />
                    {deletingId === section.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Create Section</DialogTitle>
              <HelpTooltip content={HELP_TOOLTIPS.sectionCreate} />
            </div>
            <DialogDescription>
              Add a new section within a specialisation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="section-name">Section Name</Label>
              <Input
                id="section-name"
                placeholder="e.g. Section A"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Specialisation</Label>
                <HelpTooltip content={HELP_TOOLTIPS.specialisation} />
              </div>
              <Controller
                control={form.control}
                name="specialisationId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full flex-1 min-w-0" style={{ maxWidth: '100%' }}>
                      <div className="truncate">
                        <SelectValue placeholder="Select a specialisation" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                      {specialisations.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="truncate">
                          {s.name} ({branchMap.get(s.branchId)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.specialisationId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.specialisationId.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Section'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
