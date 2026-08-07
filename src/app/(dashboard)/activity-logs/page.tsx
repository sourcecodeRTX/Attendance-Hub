'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { 
  getActivityLogs, 
  getLogSettings, 
  saveLogSettings, 
  deleteLogsByAge, 
  countLogsToDelete,
  runAutoCleanupIfEnabled,
  DeleteLogsTimeframe 
} from '@/lib/db/activity';
import { getDepartments } from '@/lib/db/university';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ActivityLog, ActivityActionType, Department, LogSettings } from '@/lib/types';
import { ScrollText, Filter, Loader2, FileSpreadsheet, FileJson, Trash2, Settings, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';

const PAGE_SIZE = 50;

const ACTION_TYPE_LABELS: Record<ActivityActionType, string> = {
  account_created: 'Account Created',
  account_deactivated: 'Account Deactivated',
  account_deleted: 'Account Deleted',
  password_reset: 'Password Reset',
  students_uploaded: 'Students Uploaded',
  student_edited: 'Student Edited',
  student_reassigned: 'Student Reassigned',
  attendance_marked: 'Attendance Marked',
  attendance_edited: 'Attendance Edited',
  attendance_archived: 'Attendance Archived',
  section_created: 'Section Created',
  section_deleted: 'Section Deleted',
  subject_created: 'Subject Created',
  subject_deleted: 'Subject Deleted',
  subject_updated: 'Subject Updated',
  teacher_subjects_assigned: 'Teacher Subjects Assigned',
  teacher_subject_removed: 'Teacher Subject Removed',
  teacher_assigned: 'Teacher Assigned',
  regular_teacher_assigned: 'Regular Teacher Assigned',
  cr_assigned: 'CR Assigned',
  cr_deleted: 'CR Deleted',
  admin_reassigned: 'Admin Reassigned',
  teacher_role_changed: 'Teacher Role Changed',
};

const ALL_ACTION_TYPES = Object.keys(ACTION_TYPE_LABELS) as ActivityActionType[];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  primary_teacher: 'Primary Teacher',
  regular_teacher: 'Regular Teacher',
  cr: 'Class Representative',
};

const RETENTION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
];

const DELETE_TIMEFRAME_OPTIONS: { value: DeleteLogsTimeframe; label: string }[] = [
  { value: '7days', label: 'Older than 7 days' },
  { value: '14days', label: 'Older than 14 days' },
  { value: '30days', label: 'Older than 30 days' },
  { value: '60days', label: 'Older than 60 days' },
  { value: '90days', label: 'Older than 90 days' },
  { value: 'all', label: 'Delete ALL logs' },
];

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '-';
  const entries = Object.entries(details);
  if (entries.length === 0) return '-';
  return entries
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');
}

export default function ActivityLogsPage() {
  const { user, university } = useAuthStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Log settings state (super_admin only)
  const [logSettings, setLogSettings] = useState<LogSettings | null>(null);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState<string>('30');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  
  // Manual delete state
  const [deleteTimeframe, setDeleteTimeframe] = useState<DeleteLogsTimeframe>('7days');
  const [logsToDeleteCount, setLogsToDeleteCount] = useState<number>(0);
  const [isCountingLogs, setIsCountingLogs] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';

  // Load log settings for super_admin
  useEffect(() => {
    if (!university || !isSuperAdmin) return;
    
    async function loadSettings() {
      try {
        const settings = await getLogSettings(university!.id);
        setLogSettings(settings);
        if (settings) {
          setAutoDeleteEnabled(settings.autoDeleteEnabled);
          setRetentionDays(settings.retentionDays?.toString() || '30');
        }
        
        // Run auto-cleanup if enabled
        const cleanupResult = await runAutoCleanupIfEnabled(university!.id);
        if (cleanupResult?.success && cleanupResult.deletedCount > 0) {
          toast.info(`Auto-cleanup: Deleted ${cleanupResult.deletedCount} old log(s)`);
        }
      } catch (err) {
        console.error('Failed to load log settings:', err);
      }
    }
    
    loadSettings();
  }, [university, isSuperAdmin]);

  useEffect(() => {
    if (!university || !user) return;
    if (!isSuperAdmin && !isAdmin) return;

    async function loadDepartments() {
      if (!university) return;
      try {
        const depts = await getDepartments(university.id);
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    }

    if (isSuperAdmin) {
      loadDepartments();
    }
  }, [university, user, isSuperAdmin, isAdmin]);

  const fetchLogs = useCallback(
    async (offset: number = 0) => {
      if (!university || !user) return;

      const departmentId =
        isSuperAdmin && selectedDepartment !== 'all'
          ? selectedDepartment
          : isAdmin
            ? user.departmentId ?? undefined
            : undefined;

      try {
        const data = await getActivityLogs(university.id, {
          departmentId,
          limit: PAGE_SIZE,
          offset,
        });
        return data;
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        toast.error('Failed to load activity logs');
        return [];
      }
    },
    [university, user, isSuperAdmin, isAdmin, selectedDepartment]
  );

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchLogs(0);
    if (data) {
      setLogs(data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setIsLoading(false);
  }, [fetchLogs]);

  useEffect(() => {
    if (!university || !user) return;
    if (!isSuperAdmin && !isAdmin) return;
    loadInitial();
  }, [university, user, isSuperAdmin, isAdmin, loadInitial]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    const data = await fetchLogs(logs.length);
    if (data) {
      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setIsLoadingMore(false);
  };

  const filteredLogs = logs.filter((log) => {
    if (startDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      if (logDate < startDate) return false;
    }
    if (endDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      if (logDate > endDate) return false;
    }
    if (selectedActionType !== 'all' && log.actionType !== selectedActionType) {
      return false;
    }
    return true;
  });

  // Prepare export data from filtered logs
  const exportData = useMemo(() => {
    return filteredLogs.map((log) => ({
      Timestamp: formatTimestamp(log.createdAt),
      Action: ACTION_TYPE_LABELS[log.actionType],
      'Performed By': log.performedByName,
      Role: ROLE_LABELS[log.performedByRole] ?? log.performedByRole,
      Target: log.targetName ?? '',
      Department: log.departmentName ?? '',
      Section: log.sectionName ?? '',
      Details: formatDetails(log.details),
    }));
  }, [filteredLogs]);

  const getFileName = (extension: string) => {
    const date = new Date().toISOString().split('T')[0];
    return `activity-logs-${date}.${extension}`;
  };

  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs to download');
      return;
    }

    setIsDownloading(true);
    try {
      const csv = Papa.unparse(exportData);
      downloadFile(csv, getFileName('csv'), 'text/csv;charset=utf-8;');
      toast.success(`Downloaded ${filteredLogs.length} logs as CSV`);
    } catch (error) {
      console.error('Failed to download CSV:', error);
      toast.error('Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadJSON = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs to download');
      return;
    }

    setIsDownloading(true);
    try {
      const json = JSON.stringify(exportData, null, 2);
      downloadFile(json, getFileName('json'), 'application/json');
      toast.success(`Downloaded ${filteredLogs.length} logs as JSON`);
    } catch (error) {
      console.error('Failed to download JSON:', error);
      toast.error('Failed to download JSON');
    } finally {
      setIsDownloading(false);
    }
  };

  // Save log settings
  const handleSaveSettings = async () => {
    if (!university || !user) return;
    
    setIsSavingSettings(true);
    try {
      const result = await saveLogSettings({
        universityId: university.id,
        autoDeleteEnabled,
        retentionDays: autoDeleteEnabled ? parseInt(retentionDays) : null,
        updatedBy: user.id,
      });
      
      if (result.success) {
        toast.success('Log settings saved successfully');
        // Refresh settings
        const settings = await getLogSettings(university.id);
        setLogSettings(settings);
      } else {
        toast.error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Count logs that will be deleted
  const handleCountLogsToDelete = async (timeframe: DeleteLogsTimeframe) => {
    if (!university) return;
    
    setDeleteTimeframe(timeframe);
    setIsCountingLogs(true);
    try {
      const count = await countLogsToDelete(university.id, timeframe);
      setLogsToDeleteCount(count);
    } catch (error) {
      console.error('Failed to count logs:', error);
      setLogsToDeleteCount(0);
    } finally {
      setIsCountingLogs(false);
    }
  };

  // Manual delete logs
  const handleDeleteLogs = async () => {
    if (!university) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteLogsByAge(university.id, deleteTimeframe);
      
      if (result.success) {
        if (result.deletedCount === 0) {
          toast.info('No logs to delete for the selected timeframe');
        } else {
          toast.success(`Deleted ${result.deletedCount} log${result.deletedCount !== 1 ? 's' : ''}`);
          // Refresh logs
          loadInitial();
        }
        setLogsToDeleteCount(0);
      } else {
        toast.error(result.error || 'Failed to delete logs');
      }
    } catch (error) {
      console.error('Failed to delete logs:', error);
      toast.error('Failed to delete logs');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user || (!isSuperAdmin && !isAdmin)) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          You do not have permission to view activity logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="size-6" />
            Activity Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all actions performed across the system
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={isDownloading || filteredLogs.length === 0}
          >
            <FileSpreadsheet className="size-4 mr-1.5" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJSON}
            disabled={isDownloading || filteredLogs.length === 0}
          >
            <FileJson className="size-4 mr-1.5" />
            Download JSON
          </Button>
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            >
              <Settings className="size-4 mr-1.5" />
              Log Settings
            </Button>
          )}
        </div>
      </div>

      {/* Super Admin Log Settings Panel */}
      {isSuperAdmin && showSettingsPanel && (
        <Card className="border-primary/20">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="size-4" />
              Log Retention Settings
            </CardTitle>
            <CardDescription>
              Configure automatic log deletion and manually delete logs
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            {/* Auto-Delete Settings */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Auto-Delete Configuration</h3>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    id="auto-delete"
                    checked={autoDeleteEnabled}
                    onCheckedChange={setAutoDeleteEnabled}
                  />
                  <Label htmlFor="auto-delete" className="cursor-pointer">
                    Enable auto-delete
                  </Label>
                </div>
                
                {autoDeleteEnabled && (
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap">Delete logs older than:</Label>
                    <Select value={retentionDays} onValueChange={(v) => { if (v) setRetentionDays(v); }}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RETENTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <Button 
                  size="sm" 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : null}
                  Save Settings
                </Button>
              </div>
              
              {logSettings && (
                <p className="text-xs text-muted-foreground">
                  {logSettings.autoDeleteEnabled 
                    ? `Auto-delete is ON. Logs older than ${logSettings.retentionDays} days will be automatically deleted.`
                    : 'Auto-delete is OFF. Logs will be kept indefinitely unless manually deleted.'}
                  {logSettings.lastAutoCleanupAt && (
                    <span className="ml-2">
                      Last auto-cleanup: {new Date(logSettings.lastAutoCleanupAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </p>
              )}
            </div>

            <Separator />

            {/* Manual Delete Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Manual Log Deletion</h3>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Select timeframe</Label>
                  <Select 
                    value={deleteTimeframe} 
                    onValueChange={(val) => handleCountLogsToDelete(val as DeleteLogsTimeframe)}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELETE_TIMEFRAME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-3">
                  {isCountingLogs ? (
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="size-3 animate-spin" />
                      Counting...
                    </span>
                  ) : logsToDeleteCount > 0 ? (
                    <Badge variant="secondary" className="text-sm">
                      {logsToDeleteCount} log{logsToDeleteCount !== 1 ? 's' : ''} will be deleted
                    </Badge>
                  ) : null}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isDeleting || isCountingLogs}
                        onClick={() => {
                          if (logsToDeleteCount === 0) {
                            handleCountLogsToDelete(deleteTimeframe);
                          }
                        }}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-4 mr-1.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-4 mr-1.5" />
                        )}
                        Delete Logs
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="size-5 text-destructive" />
                          Confirm Log Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {deleteTimeframe === 'all' ? (
                            <span className="text-destructive font-medium">
                              This will permanently delete ALL activity logs. This action cannot be undone.
                            </span>
                          ) : (
                            <>
                              This will permanently delete {logsToDeleteCount > 0 ? logsToDeleteCount : 'matching'} log{logsToDeleteCount !== 1 ? 's' : ''} that are{' '}
                              {DELETE_TIMEFRAME_OPTIONS.find(o => o.value === deleteTimeframe)?.label.toLowerCase()}.
                              This action cannot be undone.
                            </>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteLogs}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Logs
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Use the timeframe selector to preview how many logs will be deleted before confirming.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="size-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
            <div className="flex w-full flex-col gap-1.5 sm:w-auto">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>

            {isSuperAdmin && (
              <div className="flex w-full flex-col gap-1.5 sm:w-auto">
                <Label>Department</Label>
                <Select
                  value={selectedDepartment}
                  onValueChange={(val) => setSelectedDepartment(val as string)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex w-full flex-col gap-1.5 sm:w-auto">
              <Label>Action Type</Label>
              <Select
                value={selectedActionType}
                onValueChange={(val) => setSelectedActionType(val as string)}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ALL_ACTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ACTION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-full items-end sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedDepartment('all');
                  setSelectedActionType('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ScrollText className="size-10 mb-2 opacity-40" />
              <p>No activity logs found</p>
              {(startDate || endDate || selectedActionType !== 'all') && (
                <p className="text-xs mt-1">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                      <TableHead className="whitespace-nowrap">Action</TableHead>
                      <TableHead className="whitespace-nowrap">Performed By</TableHead>
                      <TableHead className="whitespace-nowrap">Role</TableHead>
                      <TableHead className="whitespace-nowrap">Target</TableHead>
                      <TableHead className="whitespace-nowrap">Department</TableHead>
                      <TableHead className="whitespace-nowrap">Section</TableHead>
                      <TableHead className="whitespace-nowrap">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ACTION_TYPE_LABELS[log.actionType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {log.performedByName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {ROLE_LABELS[log.performedByRole] ?? log.performedByRole}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{log.targetName ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {log.departmentName ?? '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {log.sectionName ?? '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {formatDetails(log.details)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {hasMore && (
                <>
                  <Separator />
                  <div className="flex justify-center p-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-1.5" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
        {filteredLogs.length !== logs.length &&
          ` (filtered from ${logs.length} total)`}
      </p>
    </div>
  );
}
