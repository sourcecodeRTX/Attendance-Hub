'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { db } from '@/lib/db';
import { clearSyncQueue } from '@/lib/db/sync';
import { wipeUniversityData, restoreUniversityData } from './actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, DatabaseBackup, Trash2, UploadCloud, Download, AlertTriangle } from 'lucide-react';
import JSZip from 'jszip';

export default function BackupPage() {
  const { user, university, clearAuth } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [settingsFile, setSettingsFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [restoredCredentials, setRestoredCredentials] = useState<Array<{ email: string; fullName: string; temporaryPassword: string }>>([]);

  const isSuperAdmin = user?.role === 'super_admin';
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const [
        users, departments, branches, specialisations, subjects, sections,
        students, subjectSections, attendanceSessions, userSections, userSubjects
      ] = await Promise.all([
        db.users.toArray(),
        db.departments.toArray(),
        db.branches.toArray(),
        db.specialisations.toArray(),
        db.subjects.toArray(),
        db.sections.toArray(),
        db.students.toArray(),
        db.subjectSections.toArray(),
        db.attendanceSessions.toArray(),
        db.userSections.toArray(),
        db.userSubjects.toArray(),
      ]);

      const settingsData = {
        users, departments, branches, specialisations, subjects, sections
      };

      const backupData = {
        students, subjectSections, attendanceSessions, userSections, userSubjects
      };

      const zip = new JSZip();
      zip.file("settings.json", JSON.stringify(settingsData, null, 2));
      zip.file("data.json", JSON.stringify(backupData, null, 2));

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup_${university?.name || 'Data'}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setHasDownloadedBackup(true);
      toast.success('Backup downloaded successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleWipe = async () => {
    if (wipeConfirmText !== 'I Want To Delete') {
      toast.error('Please type exactly "I Want To Delete" to confirm.');
      return;
    }
    if (!university || !user) return;

    setIsWiping(true);
    try {
      // 1. Wipe remote data via server action
      const res = await wipeUniversityData(university.id);
      if (!res.success) {
        throw new Error(res.error || 'Failed to wipe remote data');
      }

      // 2. Wipe local Dexie data
      await Promise.all([
        db.users.where('id').notEqual(user.id).delete(),
        db.departments.clear(),
        db.branches.clear(),
        db.specialisations.clear(),
        db.subjects.clear(),
        db.sections.clear(),
        db.students.clear(),
        db.subjectSections.clear(),
        db.attendanceSessions.clear(),
        db.userSections.clear(),
        db.userSubjects.clear(),
      ]);
      await clearSyncQueue();

      toast.success('All data has been wiped successfully. Starting fresh.');
      setWipeConfirmText('');
      setHasDownloadedBackup(false);
    } catch (error) {
      console.error('Wipe error:', error);
      toast.error('Failed to wipe data.');
    } finally {
      setIsWiping(false);
    }
  };

  const handleImport = async () => {
    if (!settingsFile || !dataFile) {
      toast.error('Please select both settings.json and data.json files.');
      return;
    }

    setIsImporting(true);
    setRestoredCredentials([]);
    try {
      // 1. Read files securely
      const settingsStr = await settingsFile.text();
      const dataStr = await dataFile.text();
      
      // 2. Parse JSON
      let settings, data;
      try {
        settings = JSON.parse(settingsStr);
        data = JSON.parse(dataStr);
      } catch (err) {
        throw new Error('Invalid JSON format. Please ensure files are not corrupted.');
      }

      // 3. Basic validation to prevent arbitrary injection
      if (typeof settings !== 'object' || typeof data !== 'object') {
        throw new Error('Invalid data structure in backup files.');
      }

      // 4. Restore data to the server directly
      const restoreRes = await restoreUniversityData(university?.id || '', settings, data);
      if (!restoreRes.success) {
        throw new Error(restoreRes.error || 'Failed to restore data to the server');
      }
      if (restoreRes.credentials && restoreRes.credentials.length > 0) {
        setRestoredCredentials(restoreRes.credentials);
      }

      // 5. Update local Dexie database to match the new server state
      await db.transaction('rw', 
        [db.users, db.departments, db.branches, db.specialisations, db.subjects, db.sections,
        db.students, db.subjectSections, db.attendanceSessions, db.userSections, db.userSubjects,
        db.syncQueue],
        async () => {
          const filterByUni = (arr: any[]) => {
            return (arr || []).filter(item => !item.universityId || item.universityId === university?.id);
          };

          // Put the data locally
          if (settings.users) await db.users.bulkPut(filterByUni(settings.users));
          if (settings.departments) await db.departments.bulkPut(filterByUni(settings.departments));
          if (settings.branches) await db.branches.bulkPut(filterByUni(settings.branches));
          if (settings.specialisations) await db.specialisations.bulkPut(filterByUni(settings.specialisations));
          if (settings.subjects) await db.subjects.bulkPut(filterByUni(settings.subjects));
          if (settings.sections) await db.sections.bulkPut(filterByUni(settings.sections));

          if (data.students) await db.students.bulkPut(filterByUni(data.students));
          if (data.subjectSections) await db.subjectSections.bulkPut(filterByUni(data.subjectSections));
          if (data.attendanceSessions) await db.attendanceSessions.bulkPut(filterByUni(data.attendanceSessions));
          if (data.userSections) await db.userSections.bulkPut(filterByUni(data.userSections));
          if (data.userSubjects) await db.userSubjects.bulkPut(filterByUni(data.userSubjects));

          // Clear any pending syncs, since we just forced a clean server state
          await db.syncQueue.clear();
        }
      );

      toast.success('Data imported successfully! It will now sync to the cloud in the background.');
      setSettingsFile(null);
      setDataFile(null);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import backup.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DatabaseBackup className="size-8 text-primary" />
          Data Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Backup your university data, restore from previous backups, or wipe the system for a new semester.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Backup Card */}
        <Card className="flex flex-col border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="size-5" />
              Download Backup
            </CardTitle>
            <CardDescription>
              Export all system settings and current data into a single ZIP file containing settings.json and data.json.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground">
              Always download a backup before wiping data or making major changes.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleExport} disabled={isExporting} className="w-full">
              {isExporting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Download className="size-4 mr-2" />}
              {isExporting ? 'Generating ZIP...' : 'Download Backup ZIP'}
            </Button>
          </CardFooter>
        </Card>

        {/* Import Backup Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Restore the system using the JSON files extracted from your Backup ZIP.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Upload both settings.json and data.json to restore.
            </p>
            
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="settings-file">settings.json</Label>
                <Input
                  id="settings-file"
                  type="file"
                  accept=".json"
                  onChange={(e) => setSettingsFile(e.target.files?.[0] || null)}
                  disabled={isImporting}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="data-file">data.json</Label>
                <Input
                  id="data-file"
                  type="file"
                  accept=".json"
                  onChange={(e) => setDataFile(e.target.files?.[0] || null)}
                  disabled={isImporting}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || !settingsFile || !dataFile} 
              className="w-full"
            >
              {isImporting ? <Loader2 className="size-4 animate-spin mr-2" /> : <UploadCloud className="size-4 mr-2" />}
              {isImporting ? 'Importing...' : 'Import JSON Files'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* One-time credentials for accounts freshly created by a restore */}
      {restoredCredentials.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/5 mt-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>One-time passwords for restored accounts</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              The following accounts were created during the restore. Share each one-time password
              with its owner securely — they will be required to change it at first login.
            </p>
            <ul className="space-y-1 font-mono text-xs">
              {restoredCredentials.map((c) => (
                <li key={c.email}>
                  {c.fullName} ({c.email}): <strong>{c.temporaryPassword}</strong>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Danger Zone */}
      <Card className="border-destructive/50 mt-8">
        <CardHeader className="bg-destructive/5 border-b border-destructive/20">
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Danger Zone: Wipe All Data
          </CardTitle>
          <CardDescription className="text-destructive/80">
            This action cannot be undone. This will permanently delete all students, attendance records, classes, and settings for the entire university.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {!hasDownloadedBackup && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Backup Required</AlertTitle>
              <AlertDescription>
                You must download a backup before you can wipe the system data.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="wipe-confirm" className={hasDownloadedBackup ? 'text-foreground' : 'text-muted-foreground'}>
              Type <strong className="font-mono bg-muted px-1 py-0.5 rounded text-destructive">I Want To Delete</strong> to confirm
            </Label>
            <Input
              id="wipe-confirm"
              placeholder="I Want To Delete"
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
              disabled={!hasDownloadedBackup || isWiping}
              className="max-w-md"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="destructive"
            disabled={!hasDownloadedBackup || isWiping || wipeConfirmText !== 'I Want To Delete'}
            onClick={handleWipe}
          >
            {isWiping ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="size-4 mr-2" />
            )}
            {isWiping ? 'Wiping Data...' : 'Permanently Delete All Data'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
