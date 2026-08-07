'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';
import { updatePassword, getUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/client';
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/utils/validation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { user, setUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  useEffect(() => {
    async function checkUser() {
      try {
        const { data } = await getUser();
        if (!data.user) {
          router.push('/login');
          return;
        }

        if (user?.mustChangePassword) {
          setMustChange(true);
        } else {
          const supabase = createClient();
          const { data: dbUser } = await supabase
            .from('users')
            .select('must_change_password')
            .eq('id', data.user.id)
            .single();

          if (dbUser?.must_change_password) {
            setMustChange(true);
          }
        }
      } catch {
        router.push('/login');
      } finally {
        setCheckingAuth(false);
      }
    }

    checkUser();
  }, [router, user]);

  useEffect(() => {
    if (mustChange) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [mustChange]);

  const onSubmit = async (data: ChangePasswordInput) => {
    setIsLoading(true);
    try {
      const { error: pwError } = await updatePassword(data.newPassword);
      if (pwError) {
        toast.error(pwError.message);
        return;
      }

      const { data: authData } = await getUser();
      if (authData.user) {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', authData.user.id);

        if (updateError) {
          toast.error(`Failed to update profile: ${updateError.message}`);
          return;
        }

        if (user) {
          setUser({ ...user, mustChangePassword: false });
        }
      }

      toast.success('Password updated successfully');
      setMustChange(false);
      router.push('/dashboard');
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Change Password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        {mustChange && (
          <Alert className="mb-4" variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              You must change your password before continuing. This page cannot
              be skipped.
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <PasswordInput
              id="newPassword"
              placeholder="••••••••"
              showStrengthMeter
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-red-500">{errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="••••••••"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
