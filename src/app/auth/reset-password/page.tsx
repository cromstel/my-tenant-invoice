'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm(): React.ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit: SubmitHandler<FormValues> = async (_data) => {
    setError(null);
    setSuccess(null);
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
      return;
    }
    setSuccess('Your password has been reset successfully. Redirecting to sign in...');
    setTimeout(() => router.push('/auth/login'), 2000);
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className="mx-auto mt-16 w-full max-w-md">
        <Card>
          <CardHeader className="space-y-1">
            <div className="mb-4 flex justify-center">
              {}
              <img src="/logo.svg" alt="myTenant Invoice" width={200} height={48} />
            </div>

            <CardTitle className="text-center text-2xl font-bold">Reset your password</CardTitle>
            <CardDescription className="text-center">
              Choose a new password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                Invalid or missing reset token. Please request a new password reset link from the{' '}
                <a href="/auth/forgot-password" className="underline">
                  forgot password page
                </a>
                .
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={isSubmitting || !token}
                  {...register('password')}
                />
                {errors.password ? (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={isSubmitting || !token}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword ? (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  {success}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
                {isSubmitting ? 'Resetting...' : 'Reset password'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <a
                href="/auth/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Back to sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
