'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/supabase/auth';
import { loginSchema, type LoginInput } from '@/lib/utils/validation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuthStore();
  const redirectedRef = useRef(false);

  const getNextPath = useCallback(() => {
    const nextPath = searchParams.get('next');
    if (nextPath && nextPath.startsWith('/')) {
      return nextPath;
    }

    return '/dashboard';
  }, [searchParams]);

  const navigateAfterAuth = useCallback((path?: string) => {
    if (redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    setIsLoading(false);

    // Force a full document navigation so middleware reads fresh auth cookies.
    window.location.assign(path ?? getNextPath());
  }, [getNextPath]);

  useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(getNextPath());
      return;
    }

    if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [authLoading, user, navigateAfterAuth, getNextPath]);


  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        if (error.message.includes('Invalid login')) {
          toast.error('Invalid email or password');
        } else {
          toast.error(error.message);
        }
        setIsLoading(false);
        return;
      }

      navigateAfterAuth(getNextPath());
    } catch {
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">ATT Tracker</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@university.edu"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" role="alert" className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
        <div className="mt-4 space-y-2 text-center text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
          <p className="text-muted-foreground">
            Want to register a new university?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
