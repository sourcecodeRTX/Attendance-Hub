'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  UserX,
  Copy,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { deactivateDepartmentAdmin, getDepartments } from '@/lib/db/university';
import { logActivity } from '@/lib/db/activity';
import { createManagedAuthUser, deactivateManagedAuthUser } from '../actions';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import type { Department, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

const createDeptFormSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code too long'),
  adminFullName: z.string().min(2, 'Full name is required'),
  adminStaffId: z.string().min(1, 'Staff ID is required'),
  adminEmail: z.string().email('Invalid email address'),
});

type CreateDeptFormData = z.infer<typeof createDeptFormSchema>;

const handoverFormSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
  email: z.string().email('Invalid email address'),
});

type HandoverFormData = z.infer<typeof handoverFormSchema>;

interface DeptWithAdmins extends Department {
  admins: User[];
}

export default function DepartmentsPage() {
  const { user, university } = useAuthStore();
  const [departments, setDepartments] = useState<DeptWithAdmins[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [isReplacementRequiredOpen, setIsReplacementRequiredOpen] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState<User | null>(null);
  const [pendingDept, setPendingDept] = useState<DeptWithAdmins | null>(null);

  const form = useForm<CreateDeptFormData>({
    resolver: zodResolver(createDeptFormSchema),
    defaultValues: {
      name: '',
      code: '',
      adminFullName: '',
      adminStaffId: '',
      adminEmail: '',
    },
  });

  const handoverForm = useForm<HandoverFormData>({
    resolver: zodResolver(handoverFormSchema),
    defaultValues: {
      fullName: '',
      staffId: '',
      email: '',
    },
  });

  const loadData = useCallback(async () => {
    if (!user || !university) return;
    setLoading(true);
    try {
      // First try to get fresh data from Supabase
      const depts = await getDepartments(university.id);
      const { data: userRows, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('university_id', university.id);

      let universityUsers: User[];
      
      if (usersError) {
        // Fallback to local database if Supabase fails
        universityUsers = await db.users.where('universityId').equals(university.id).toArray();
      } else {
        universityUsers = (userRows ?? []).map((row) => ({
          id: row.id,
          universityId: row.university_id,
          role: row.role,
          fullName: row.full_name,
          staffId: row.staff_id,
          email: row.email,
          departmentId: row.department_id,
          isActive: row.is_active,
          mustChangePassword: row.must_change_password,
          createdAt: row.created_at,
          createdBy: row.created_by,
        }));
        await Promise.all(universityUsers.map((u) => db.users.put(u)));
      }

      const adminUsers = universityUsers.filter((row) => row.role === 'admin');

      const deptsWithAdmins: DeptWithAdmins[] = depts.map((d) => ({
        ...d,
        admins: adminUsers.filter((a) => a.departmentId === d.id),
      }));
      setDepartments(deptsWithAdmins);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [user, university]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDepts = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = form.handleSubmit(async (data) => {
    if (!user || !university) return;
    setSubmitting(true);
    try {
      const tempPassword = `Temp-${crypto.randomUUID().slice(0, 8)}`;

      const managedAuth = await createManagedAuthUser({
        email: data.adminEmail,
        password: tempPassword,
      });

      if (!managedAuth.success || !managedAuth.userId) {
        throw new Error(managedAuth.error || 'Failed to create auth user');
      }

      const authUserId = managedAuth.userId;
      const departmentId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { error: departmentCreateError } = await supabase
        .from('departments')
        .insert({
          id: departmentId,
          university_id: university.id,
          name: data.name,
          code: data.code.toUpperCase(),
          admin_id: null,
          is_active: true,
          created_at: now,
          created_by: user.id,
        });
      if (departmentCreateError) throw new Error(departmentCreateError.message);

      const { error: userError } = await supabase.from('users').insert({
        id: authUserId,
        university_id: university.id,
        role: 'admin',
        full_name: data.adminFullName,
        staff_id: data.adminStaffId,
        email: data.adminEmail,
        department_id: departmentId,
        is_active: true,
        must_change_password: true,
        created_at: now,
        created_by: user.id,
      });
      if (userError) throw new Error(userError.message);

      const { error: departmentUpdateError } = await supabase
        .from('departments')
        .update({ admin_id: authUserId })
        .eq('id', departmentId);
      if (departmentUpdateError) throw new Error(departmentUpdateError.message);

      const newUser: User = {
        id: authUserId,
        universityId: university.id,
        role: 'admin',
        fullName: data.adminFullName,
        staffId: data.adminStaffId,
        email: data.adminEmail,
        departmentId: departmentId,
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        createdBy: user.id,
      };
      await db.users.put(newUser);

      const newDept: Department = {
        id: departmentId,
        universityId: university.id,
        name: data.name,
        code: data.code.toUpperCase(),
        adminId: authUserId,
        isActive: true,
        createdAt: now,
        createdBy: user.id,
      };
      await db.departments.put(newDept);

      await logActivity({
        universityId: university.id,
        actionType: 'account_created',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: data.adminFullName,
        departmentName: data.name,
        details: { role: 'admin', email: data.adminEmail },
      });

      setTempCredentials({ email: data.adminEmail, password: tempPassword });
      setIsCreateOpen(false);
      setIsCredentialsOpen(true);
      form.reset();
      toast.success('Department created successfully');
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create department';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const openDeactivateFlow = (adminUser: User, dept: DeptWithAdmins) => {
    setPendingAdmin(adminUser);
    setPendingDept(dept);
    handoverForm.reset();
    setIsReplacementRequiredOpen(true);
  };

  const handleAssignAndDeactivate = handoverForm.handleSubmit(async (data) => {
    if (!user || !university || !pendingAdmin || !pendingDept) return;

    setDeactivating(true);
    try {
      const tempPassword = `Temp-${crypto.randomUUID().slice(0, 8)}`;
      const managedAuth = await createManagedAuthUser({
        email: data.email,
        password: tempPassword,
      });

      if (!managedAuth.success || !managedAuth.userId) {
        throw new Error(managedAuth.error || 'Failed to create replacement admin auth account');
      }

      const deactivateResult = await deactivateManagedAuthUser(pendingAdmin.id);
      if (!deactivateResult.success) {
        throw new Error(deactivateResult.error ?? 'Failed to deactivate auth account');
      }

      await deactivateDepartmentAdmin(
        pendingAdmin,
        pendingDept,
        {
          userId: managedAuth.userId,
          fullName: data.fullName,
          staffId: data.staffId,
          email: data.email,
        },
        user.id
      );

      await logActivity({
        universityId: university.id,
        actionType: 'account_deactivated',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: pendingAdmin.fullName,
        departmentName: pendingDept.name,
        details: {
          replacementAdminName: data.fullName,
          replacementAdminEmail: data.email,
        },
      });

      setIsReplacementRequiredOpen(false);
      setPendingAdmin(null);
      setPendingDept(null);
      handoverForm.reset();
      setTempCredentials({ email: data.email, password: tempPassword });
      setIsCredentialsOpen(true);

      toast.success('Admin deactivated. Changes queued for sync.');
      
      // Force refresh from local database immediately to show updated state
      // The local database was already updated by deactivateDepartmentAdmin
      const localDepts = await db.departments.where('universityId').equals(university.id).toArray();
      const localUsers = await db.users.where('universityId').equals(university.id).toArray();
      const adminUsers = localUsers.filter((u) => u.role === 'admin');
      const deptsWithAdmins: DeptWithAdmins[] = localDepts.map((d) => ({
        ...d,
        admins: adminUsers.filter((a) => a.departmentId === d.id),
      }));
      setDepartments(deptsWithAdmins);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign and deactivate admin';
      toast.error(message);
    } finally {
      setDeactivating(false);
    }
  });

  const handleSetPrimaryAdmin = async (adminUser: User, dept: DeptWithAdmins) => {
    if (!user || !university) return;
    if (!adminUser.isActive) {
      toast.error('Only active admins can be assigned as primary.');
      return;
    }
    if (dept.adminId === adminUser.id) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update({ admin_id: adminUser.id })
        .eq('id', dept.id);

      if (error) throw error;

      await db.departments.put({ ...dept, adminId: adminUser.id });

      await logActivity({
        universityId: university.id,
        actionType: 'admin_reassigned',
        performedByRole: user.role,
        performedByName: user.fullName,
        performedById: user.id,
        targetName: adminUser.fullName,
        departmentName: dept.name,
        details: { newAdminId: adminUser.id },
      });

      toast.success('Primary admin reassigned');
      await loadData();
    } catch {
      toast.error('Failed to reassign primary admin');
    }
  };

  if (!user || user.role !== 'super_admin') return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-sm text-muted-foreground">
            Manage departments and their administrators
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Create Department
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search departments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading departments...
        </div>
      ) : filteredDepts.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {searchQuery
            ? 'No departments match your search'
            : 'No departments created yet'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Admin Name</TableHead>
              <TableHead>Admin Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDepts.map((dept) => {
              const primaryAdmin = dept.admins.find(
                (a) => a.id === dept.adminId
              );
              const isExpanded = expandedDeptId === dept.id;
              return (
                <Fragment key={dept.id}>
                  <TableRow>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setExpandedDeptId(isExpanded ? null : dept.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{dept.code}</Badge>
                    </TableCell>
                    <TableCell>{primaryAdmin?.fullName ?? '\u2014'}</TableCell>
                    <TableCell>{primaryAdmin?.email ?? '\u2014'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={dept.isActive ? 'default' : 'destructive'}
                      >
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedDeptId(isExpanded ? null : dept.id)
                        }
                      >
                        {isExpanded ? 'Collapse' : 'View Admins'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-0">
                        <div className="p-4 space-y-3">
                          <h4 className="text-sm font-medium">
                            Administrators ({dept.admins.length})
                          </h4>
                          {dept.admins.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No administrators assigned
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {dept.admins.map((admin) => (
                                <div
                                  key={admin.id}
                                  className="flex items-center justify-between rounded-lg border bg-background p-3"
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">
                                      {admin.fullName}
                                      {admin.id === dept.adminId && (
                                        <Badge
                                          variant="secondary"
                                          className="ml-2"
                                        >
                                          Primary
                                        </Badge>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {admin.email} &middot; Staff ID:{' '}
                                      {admin.staffId}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={
                                        admin.isActive
                                          ? 'default'
                                          : 'destructive'
                                      }
                                    >
                                      {admin.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                    {admin.isActive && (
                                      <>
                                        {admin.id !== dept.adminId && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              handleSetPrimaryAdmin(admin, dept)
                                            }
                                          >
                                            Set Primary
                                          </Button>
                                        )}
                                        {admin.id === dept.adminId && (
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() =>
                                              openDeactivateFlow(admin, dept)
                                            }
                                          >
                                            <UserX
                                              className="size-3.5"
                                              data-icon="inline-start"
                                            />
                                            Deactivate
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Department</DialogTitle>
            <DialogDescription>
              Create a new department and its admin account simultaneously.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dept-name">Department Name</Label>
                <Input
                  id="dept-name"
                  placeholder="e.g. Computer Science"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-code">Department Code</Label>
                <Input
                  id="dept-code"
                  placeholder="e.g. CS"
                  {...form.register('code')}
                />
                {form.formState.errors.code && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.code.message}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Admin Account</h4>
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Full Name</Label>
                <Input
                  id="admin-name"
                  placeholder="Admin full name"
                  {...form.register('adminFullName')}
                />
                {form.formState.errors.adminFullName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.adminFullName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-staffid">Staff ID</Label>
                <Input
                  id="admin-staffid"
                  placeholder="e.g. ADM001"
                  {...form.register('adminStaffId')}
                />
                {form.formState.errors.adminStaffId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.adminStaffId.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@university.edu"
                  {...form.register('adminEmail')}
                />
                {form.formState.errors.adminEmail && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.adminEmail.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Account Created</DialogTitle>
            <DialogDescription>
              Share these temporary credentials with the admin. They must change
              their password on first login.
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

      <Dialog
        open={isReplacementRequiredOpen}
        onOpenChange={(open) => {
          setIsReplacementRequiredOpen(open);
          if (!open) {
            setPendingAdmin(null);
            setPendingDept(null);
            handoverForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mandatory Admin Handover</DialogTitle>
            <DialogDescription>
              Please assign a new admin to this department before deactivating the current one.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssignAndDeactivate} className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">New Department Admin</h4>

              <div className="space-y-1.5">
                <Label htmlFor="handover-name">Full Name</Label>
                <Input
                  id="handover-name"
                  placeholder="New admin full name"
                  {...handoverForm.register('fullName')}
                />
                {handoverForm.formState.errors.fullName && (
                  <p className="text-xs text-destructive">
                    {handoverForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="handover-staff-id">Staff ID</Label>
                <Input
                  id="handover-staff-id"
                  placeholder="e.g. ADM002"
                  {...handoverForm.register('staffId')}
                />
                {handoverForm.formState.errors.staffId && (
                  <p className="text-xs text-destructive">
                    {handoverForm.formState.errors.staffId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="handover-email">Email</Label>
                <Input
                  id="handover-email"
                  type="email"
                  placeholder="new.admin@university.edu"
                  {...handoverForm.register('email')}
                />
                {handoverForm.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {handoverForm.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReplacementRequiredOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" type="submit" disabled={deactivating}>
                {deactivating ? 'Applying Handover...' : 'Assign & Deactivate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
