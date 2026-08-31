'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { signIn } from '@/lib/supabase/auth';
import { registerSchema } from '@/lib/utils/validation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { registerUniversity } from './actions';

const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormInput = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const { user, isVerified, isLoading: authLoading } = useAuthStore();
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
    if (!authLoading && isVerified && user) {
      navigateAfterAuth(getNextPath());
    }
  }, [authLoading, isVerified, user, navigateAfterAuth, getNextPath]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
  });

  const onSubmit = async (data: RegisterFormInput) => {
    setIsLoading(true);

    try {
      const result = await registerUniversity({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        staffId: data.staffId,
        universityName: data.universityName,
        universityCode: data.universityCode,
      });

      if (!result.success) {
        toast.error(result.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      const { error: signInError } = await signIn(data.email, data.password);
      if (signInError) {
        toast.error('Registered but failed to sign in. Please try logging in.');
        navigateAfterAuth('/login');
        return;
      }

      toast.success('University registered successfully');
      navigateAfterAuth(getNextPath());
    } catch {
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Register University</CardTitle>
        <CardDescription>
          Create a new university and your super admin account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'fullName-error' : undefined}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p id="fullName-error" role="alert" className="text-sm text-red-500">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffId">Staff ID</Label>
            <Input
              id="staffId"
              type="text"
              placeholder="STF-001"
              aria-invalid={!!errors.staffId}
              aria-describedby={errors.staffId ? 'staffId-error' : undefined}
              {...register('staffId')}
            />
            {errors.staffId && (
              <p id="staffId-error" role="alert" className="text-sm text-red-500">{errors.staffId.message}</p>
            )}
          </div>

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
              showStrengthMeter
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" role="alert" className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="••••••••"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p id="confirmPassword-error" role="alert" className="text-sm text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="universityName">University Name</Label>
            <Input
              id="universityName"
              type="text"
              placeholder="State University"
              aria-invalid={!!errors.universityName}
              aria-describedby={errors.universityName ? 'universityName-error' : undefined}
              {...register('universityName')}
            />
            {errors.universityName && (
              <p id="universityName-error" role="alert" className="text-sm text-red-500">{errors.universityName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="universityCode">University Code</Label>
            <Input
              id="universityCode"
              type="text"
              placeholder="SU"
              aria-invalid={!!errors.universityCode}
              aria-describedby={errors.universityCode ? 'universityCode-error' : undefined}
              {...register('universityCode')}
            />
            {errors.universityCode && (
              <p id="universityCode-error" role="alert" className="text-sm text-red-500">{errors.universityCode.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register University
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
