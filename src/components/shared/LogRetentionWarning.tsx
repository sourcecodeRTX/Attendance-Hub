'use client';

import { AlertTriangle, FileJson, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LogRetentionWarningProps {
  onDownloadCSV: () => void;
  onDownloadJSON: () => void;
  isDownloading?: boolean;
}

export function LogRetentionWarning({
  onDownloadCSV,
  onDownloadJSON,
  isDownloading = false,
}: LogRetentionWarningProps) {
  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="size-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400">
        Weekly Log Cleanup Scheduled
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">
          This week&apos;s logs will be automatically deleted tomorrow evening. If you want
          to keep them, please download them now.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadCSV}
            disabled={isDownloading}
            className="border-amber-500/50 hover:bg-amber-500/10"
          >
            <FileSpreadsheet className="size-4 mr-1.5" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadJSON}
            disabled={isDownloading}
            className="border-amber-500/50 hover:bg-amber-500/10"
          >
            <FileJson className="size-4 mr-1.5" />
            Download JSON
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function isSaturday(): boolean {
  return new Date().getDay() === 6;
}
