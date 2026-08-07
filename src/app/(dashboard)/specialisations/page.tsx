'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  getBranches,
  getSpecialisations,
  createSpecialisation,
  updateSpecialisation,
} from '@/lib/db/university';
import {
  specialisationSchema,
  type SpecialisationInput,
} from '@/lib/utils/validation';
import type { Branch, Specialisation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

export default function SpecialisationsPage() {
  const { user, university } = useAuthStore();
  const [specialisations, setSpecialisations] = useState<Specialisation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSpec, setEditSpec] = useState<Specialisation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const form = useForm<SpecialisationInput>({
    resolver: zodResolver(specialisationSchema),
    defaultValues: { name: '', code: '', branchId: '' },
  });

  const editForm = useForm<SpecialisationInput>({
    resolver: zodResolver(specialisationSchema),
    defaultValues: { name: '', code: '', branchId: '' },
  });

  const loadData = useCallback(async () => {
    if (!user || !university || !user.departmentId) return;
    try {
      const [branchData, branchAllData, specData] = await Promise.all([
        getBranches(university.id, user.departmentId),
        getBranches(university.id),
        getSpecialisations(university.id),
      ]);
      setBranches(branchData);
      setAllBranches(branchAllData);
      const deptSpecs = specData.filter(
        (s) => s.departmentId === user.departmentId
      );
      setSpecialisations(deptSpecs);
    } catch {
      toast.error('Failed to load specialisations');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const branchMap = new Map(allBranches.map((b) => [b.id, b.name]));

  const filteredSpecs = specialisations.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch =
      filterBranchId === 'all' || s.branchId === filterBranchId;
    return matchesSearch && matchesBranch;
  });

  const handleCreate = form.handleSubmit(async (data) => {
    if (!user || !university || !user.departmentId) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const newSpec: Specialisation = {
        id: crypto.randomUUID(),
        universityId: university.id,
        departmentId: user.departmentId,
        branchId: data.branchId,
        name: data.name,
        code: data.code.toUpperCase(),
        isActive: true,
        createdAt: now,
        createdBy: user.id,
      };
      await createSpecialisation(newSpec, user.id);

      setIsCreateOpen(false);
      form.reset();
      toast.success('Specialisation created successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create specialisation';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const openEdit = (spec: Specialisation) => {
    setEditSpec(spec);
    editForm.reset({
      name: spec.name,
      code: spec.code,
      branchId: spec.branchId,
    });
    setIsEditOpen(true);
  };

  const handleEdit = editForm.handleSubmit(async (data) => {
    if (!user || !university || !editSpec) return;
    setEditSubmitting(true);
    try {
      await updateSpecialisation(
        {
          ...editSpec,
          name: data.name,
          code: data.code.toUpperCase(),
          branchId: data.branchId,
        },
        user.id
      );

      setIsEditOpen(false);
      setEditSpec(null);
      editForm.reset();
      toast.success('Specialisation updated successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update specialisation';
      toast.error(message);
    } finally {
      setEditSubmitting(false);
    }
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Specialisations</h1>
          <p className="text-sm text-muted-foreground">
            Manage specialisations within your department
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Create Specialisation
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search specialisations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={filterBranchId}
          onValueChange={(val) => setFilterBranchId(val as string)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading specialisations...
        </div>
      ) : filteredSpecs.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {searchQuery || filterBranchId !== 'all'
            ? 'No specialisations match your filters'
            : 'No specialisations created yet'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpecs.map((spec) => (
              <TableRow key={spec.id}>
                <TableCell className="font-medium">{spec.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{spec.code}</Badge>
                </TableCell>
                <TableCell>
                  {branchMap.get(spec.branchId) ?? 'Unknown'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={spec.isActive ? 'default' : 'destructive'}
                  >
                    {spec.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(spec)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Specialisation</DialogTitle>
            <DialogDescription>
              Add a new specialisation under a branch.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="spec-name">Specialisation Name</Label>
              <Input
                id="spec-name"
                placeholder="e.g. Artificial Intelligence"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-code">Specialisation Code</Label>
              <Input
                id="spec-code"
                placeholder="e.g. AI"
                {...form.register('code')}
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.branchId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.branchId.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Specialisation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditSpec(null);
            editForm.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Specialisation</DialogTitle>
            <DialogDescription>
              Update specialisation details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-spec-name">Specialisation Name</Label>
              <Input
                id="edit-spec-name"
                placeholder="e.g. Artificial Intelligence"
                {...editForm.register('name')}
              />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-spec-code">Specialisation Code</Label>
              <Input
                id="edit-spec-code"
                placeholder="e.g. AI"
                {...editForm.register('code')}
              />
              {editForm.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {editForm.formState.errors.code.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Controller
                control={editForm.control}
                name="branchId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {editForm.formState.errors.branchId && (
                <p className="text-xs text-destructive">
                  {editForm.formState.errors.branchId.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Updating...' : 'Update Specialisation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
