'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getBranches, createBranch, updateBranch } from '@/lib/db/university';
import { branchSchema, type BranchInput } from '@/lib/utils/validation';
import type { Branch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

export default function BranchesPage() {
  const { user, university } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const form = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: '', code: '' },
  });

  const editForm = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: '', code: '' },
  });

  const loadData = useCallback(async () => {
    if (!user || !university || !user.departmentId) return;
    try {
      const data = await getBranches(university.id, user.departmentId);
      setBranches(data);
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = form.handleSubmit(async (data) => {
    if (!user || !university || !user.departmentId) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const newBranch: Branch = {
        id: crypto.randomUUID(),
        universityId: university.id,
        departmentId: user.departmentId,
        name: data.name,
        code: data.code.toUpperCase(),
        isActive: true,
        createdAt: now,
        createdBy: user.id,
      };
      await createBranch(newBranch, user.id);

      setIsCreateOpen(false);
      form.reset();
      toast.success('Branch created successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create branch';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const openEdit = (branch: Branch) => {
    setEditBranch(branch);
    editForm.reset({ name: branch.name, code: branch.code });
    setIsEditOpen(true);
  };

  const handleEdit = editForm.handleSubmit(async (data) => {
    if (!user || !university || !editBranch) return;
    setEditSubmitting(true);
    try {
      await updateBranch(
        {
          ...editBranch,
          name: data.name,
          code: data.code.toUpperCase(),
        },
        user.id
      );

      setIsEditOpen(false);
      setEditBranch(null);
      editForm.reset();
      toast.success('Branch updated successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update branch';
      toast.error(message);
    } finally {
      setEditSubmitting(false);
    }
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="text-sm text-muted-foreground">
            Manage branches within your department
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Create Branch
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search branches..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading branches...
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {searchQuery
            ? 'No branches match your search'
            : 'No branches created yet'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBranches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{branch.code}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={branch.isActive ? 'default' : 'destructive'}
                  >
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(branch.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(branch)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>
              Add a new branch to your department.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                placeholder="e.g. Information Technology"
                aria-invalid={!!form.formState.errors.name}
                aria-describedby={form.formState.errors.name ? 'branch-name-error' : undefined}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p id="branch-name-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-code">Branch Code</Label>
              <Input
                id="branch-code"
                placeholder="e.g. IT"
                aria-invalid={!!form.formState.errors.code}
                aria-describedby={form.formState.errors.code ? 'branch-code-error' : undefined}
                {...form.register('code')}
              />
              {form.formState.errors.code && (
                <p id="branch-code-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Branch'}
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
            setEditBranch(null);
            editForm.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch name and code.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-branch-name">Branch Name</Label>
              <Input
                id="edit-branch-name"
                placeholder="e.g. Information Technology"
                aria-invalid={!!editForm.formState.errors.name}
                aria-describedby={editForm.formState.errors.name ? 'edit-branch-name-error' : undefined}
                {...editForm.register('name')}
              />
              {editForm.formState.errors.name && (
                <p id="edit-branch-name-error" role="alert" className="text-xs text-destructive">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-branch-code">Branch Code</Label>
              <Input
                id="edit-branch-code"
                placeholder="e.g. IT"
                aria-invalid={!!editForm.formState.errors.code}
                aria-describedby={editForm.formState.errors.code ? 'edit-branch-code-error' : undefined}
                {...editForm.register('code')}
              />
              {editForm.formState.errors.code && (
                <p id="edit-branch-code-error" role="alert" className="text-xs text-destructive">
                  {editForm.formState.errors.code.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Updating...' : 'Update Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
