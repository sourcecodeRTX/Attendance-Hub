'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { HelpTooltip, HELP_TOOLTIPS } from '@/components/ui/help-tooltip';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Volume2, Lock, Building2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, university, setUniversity } = useAuthStore();
  const { soundEnabled, setSoundEnabled } = usePreferencesStore();

  const [uniName, setUniName] = useState(university?.name ?? '');
  const [uniCode, setUniCode] = useState(university?.code ?? '');
  const [threshold, setThreshold] = useState(
    university?.attendanceThreshold ?? 75
  );
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  async function handleSaveUniversitySettings() {
    if (!university) return;

    if (!uniName.trim() || !uniCode.trim()) {
      toast.error('University name and code are required');
      return;
    }

    if (threshold < 1 || threshold > 100) {
      toast.error('Threshold must be between 1 and 100');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('universities')
        .update({
          name: uniName.trim(),
          code: uniCode.trim(),
          attendance_threshold: Math.round(threshold),
        })
        .eq('id', university.id);

      if (error) throw error;

      setUniversity({
        ...university,
        name: uniName.trim(),
        code: uniCode.trim(),
        attendanceThreshold: Math.round(threshold),
      });

      toast.success('University settings saved');
    } catch (_err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="size-4" />
            Preferences
          </CardTitle>
          <CardDescription>General app preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sound-effects" className="text-sm font-medium">
                Sound Effects
              </Label>
              <p className="text-xs text-muted-foreground">
                Play sounds for attendance marking and notifications
              </p>
            </div>
            <Switch
              id="sound-effects"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Change Password</p>
              <p className="text-xs text-muted-foreground">
                Update your account password
              </p>
            </div>
            <Button variant="outline" size="sm" nativeButton={false} render={<a href="/change-password" />}>
              <Lock className="size-3.5" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              University Settings
            </CardTitle>
            <CardDescription>
              Manage your university configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="uni-name">University Name</Label>
              <Input
                id="uni-name"
                value={uniName}
                onChange={(e) => setUniName(e.target.value)}
                placeholder="University name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uni-code">University Code</Label>
              <Input
                id="uni-code"
                value={uniCode}
                onChange={(e) => setUniCode(e.target.value)}
                placeholder="University code"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="threshold">Attendance Threshold (%)</Label>
                <HelpTooltip content={HELP_TOOLTIPS.attendanceThreshold} />
              </div>
              <Input
                id="threshold"
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Students below this percentage will be flagged as at-risk
              </p>
            </div>
            <Button
              onClick={handleSaveUniversitySettings}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
