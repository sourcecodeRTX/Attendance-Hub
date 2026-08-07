'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getUserSections, createUserSection, deleteUserSectionsByUser } from '@/lib/db/user-sections';
import { logActivity } from '@/lib/db/activity';
import { createManagedAuthUser } from '../actions';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/db/index';
import type { User, Section, UserSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip, HELP_TOOLTIPS } from '@/components/ui/help-tooltip';
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
import { Plus, Trash2, Loader2, KeyRound, Users } from 'lucide-react';

interface CRUser extends User {
  sectionName: string;
}

export default function CRManagementPage() {
  const { user, university } = useAuthStore();

  const [crUsers, setCrUsers] = useState<CRUser[]>([]);
  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [tempCredentials, setTempCredentials] = useState({ email: '', password: '' });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCR, setDeleteCR] = useState<CRUser | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetCR, setResetCR] = useState<CRUser | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !university) return;

    if (user.role !== 'primary_teacher') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userSecs = await getUserSections(user.id);
      if (userSecs.length === 0) {
        setLoading(false);
        return;
      }

      const sectionId = userSecs[0].sectionId;
      const sec = await db.sections.get(sectionId);
      if (sec) setSection(sec);

      const sectionUserSections = await db.userSections
        .where('sectionId')
        .equals(sectionId)
        .filter((us) => us.userRole === 'cr')
        .toArray();

      const crList: CRUser[] = [];
      for (const us of sectionUserSections) {
        const crUser = await db.users.get(us.userId);
        if (crUser) {
          crList.push({
            ...crUser,
            sectionName: sec?.name ?? 'Unknown',
          });
        }
      }
      setCrUsers(crList);
    } catch (_err) {
      toast.error('Failed to load CRs');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateCR() {
    if (!user || !university || !section) return;

    if (!createName.trim() || !createEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setCreateSubmitting(true);
    try {
      const generatedStaffId = `CR-${Date.now()}`;
      const password = generatedStaffId;
      const managedAuth = await createManagedAuthUser({
        email: createEmail.trim(),
        password,
      });

      if (!managedAuth.success || !managedAuth.userId) {
        toast.error(managedAuth.error ?? 'Failed to create auth user');
        setCreateSubmitting(false);
        return;
      }

      const newUserId = managedAuth.userId;

      const newUser: User = {
        id: newUserId,
        universityId: university.id,
        role: 'cr',
        fullName: createName.trim(),
        staffId: generatedStaffId,
        email: createEmail.trim(),
        departmentId: section.departmentId,
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      await db.users.put(newUser);
      await db.syncQueue.add({
        universityId: university.id,
        ownerId: user.id,
        type: 'create',
        collection: 'users',
        docId: newUserId,
        data: {
          id: newUserId,
          university_id: university.id,
          role: 'cr',
          full_name: newUser.fullName,
          staff_id: newUser.staffId,
          email: newUser.email,
          department_id: section.departmentId,
          is_active: true,
          must_change_password: true,
          created_at: newUser.createdAt,
          created_by: user.id,
        },
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const userSection: UserSection = {
        id: crypto.randomUUID(),
        universityId: university.id,
        userId: newUserId,
        sectionId: section.id,
        userRole: 'cr',
        assignedAt: new Date().toISOString(),
        assignedBy: user.id,
      };
      await createUserSection(userSection, user.id);

      await logActivity({
        universityId: university.id,
        departmentId: section.departmentId,
        actionType: 'cr_assigned',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: newUser.fullName,
        sectionName: section.name,
      });

      setTempCredentials({ email: createEmail.trim(), password });
      setCreateOpen(false);
      setCreateName('');
      setCreateEmail('');
      setCredentialsOpen(true);
      toast.success('CR account created');
      loadData();
    } catch (_err) {
      toast.error('Failed to create CR');
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleDeleteCR() {
    if (!user || !university || !deleteCR) return;

    setDeleteSubmitting(true);
    try {
      await supabase.auth.admin.updateUserById(deleteCR.id, {
        ban_duration: 'none',
        user_metadata: { disabled: true },
      });

      const crUser = await db.users.get(deleteCR.id);
      if (crUser) {
        crUser.isActive = false;
        await db.users.put(crUser);
        await db.syncQueue.add({
          universityId: university.id,
          ownerId: user.id,
          type: 'update',
          collection: 'users',
          docId: deleteCR.id,
          data: { is_active: false },
          createdAt: new Date().toISOString(),
          retryCount: 0,
        });
      }

      await deleteUserSectionsByUser(deleteCR.id, university.id, user.id);

      await logActivity({
        universityId: university.id,
        departmentId: deleteCR.departmentId,
        actionType: 'cr_deleted',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: deleteCR.fullName,
        sectionName: section?.name ?? null,
      });

      toast.success(`CR "${deleteCR.fullName}" deactivated`);
      setDeleteOpen(false);
      setDeleteCR(null);
      loadData();
    } catch (_err) {
      toast.error('Failed to delete CR');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!user || !university || !resetCR) return;

    setResetSubmitting(true);
    try {
      await supabase.auth.admin.updateUserById(resetCR.id, {
        password: resetCR.staffId,
      });

      const crUser = await db.users.get(resetCR.id);
      if (crUser) {
        crUser.mustChangePassword = true;
        await db.users.put(crUser);
        await db.syncQueue.add({
          universityId: university.id,
          ownerId: user.id,
          type: 'update',
          collection: 'users',
          docId: resetCR.id,
          data: { must_change_password: true },
          createdAt: new Date().toISOString(),
          retryCount: 0,
        });
      }

      await logActivity({
        universityId: university.id,
        departmentId: resetCR.departmentId,
        actionType: 'password_reset',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: resetCR.fullName,
      });

      toast.success(`Password reset to Staff ID for ${resetCR.fullName}`);
      setResetOpen(false);
      setResetCR(null);
    } catch (_err) {
      toast.error('Failed to reset password');
    } finally {
      setResetSubmitting(false);
    }
  }

  if (!user) return null;

  if (user.role !== 'primary_teacher') {
    return (
      <div className="py-12 text-center text-muted-foreground">
        You do not have permission to manage Class Representatives.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">CR Management</h1>
            <HelpTooltip content={HELP_TOOLTIPS.cr} />
          </div>
          {section && (
            <p className="text-sm text-muted-foreground">
              Managing CRs for {section.name}
            </p>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create CR
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : crUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="mb-2 size-10" />
          <p>No Class Representatives yet. Create one to get started.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Staff ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crUsers.map((cr) => (
              <TableRow key={cr.id}>
                <TableCell className="font-medium">{cr.fullName}</TableCell>
                <TableCell className="font-mono">{cr.staffId}</TableCell>
                <TableCell>{cr.email}</TableCell>
                <TableCell>{cr.sectionName}</TableCell>
                <TableCell>
                  <Badge variant={cr.isActive ? 'default' : 'secondary'}>
                    {cr.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setResetCR(cr);
                        setResetOpen(true);
                      }}
                      title="Reset password"
                    >
                      <KeyRound className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setDeleteCR(cr);
                        setDeleteOpen(true);
                      }}
                      title="Delete CR"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create CR Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateName('');
            setCreateEmail('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Class Representative</DialogTitle>
            <DialogDescription>
              Create a new CR account for {section?.name ?? 'your section'}.
              The initial temporary password will be generated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cr-name">Full Name</Label>
              <Input
                id="cr-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-email">Email</Label>
              <Input
                id="cr-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="e.g. jane@university.edu"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleCreateCR} disabled={createSubmitting}>
              {createSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create CR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary Credentials Dialog */}
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>CR Account Created</DialogTitle>
            <DialogDescription>
              Share these temporary credentials with the CR. They will be
              required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-mono text-sm">{tempCredentials.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Temporary Password</p>
              <p className="font-mono text-sm">{tempCredentials.password}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Email: ${tempCredentials.email}\nPassword: ${tempCredentials.password}`
                );
                toast.success('Credentials copied to clipboard');
              }}
            >
              Copy
            </Button>
            <DialogClose render={<Button />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete CR Dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteCR(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Class Representative</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">
                {deleteCR?.fullName}
              </span>
              ? Their account will be disabled and section access revoked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteCR}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting && <Loader2 className="size-4 animate-spin" />}
              Delete CR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setResetCR(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset the password for{' '}
              <span className="font-medium text-foreground">
                {resetCR?.fullName}
              </span>{' '}
              back to their Staff ID (
              <span className="font-mono">{resetCR?.staffId}</span>)?
              They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleResetPassword} disabled={resetSubmitting}>
              {resetSubmitting && <Loader2 className="size-4 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
