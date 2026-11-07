'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Suspense, useState } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const adminLoginFormSchema = z.object({
  email: z.string().email('Please enter a valid admin email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof adminLoginFormSchema>;

function AdminLoginForm(): React.ReactNode {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/admin';
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(adminLoginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result?.error) {
        setError('Invalid admin credentials. Please try again.');
        return;
      }

      router.push(callbackUrl);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mx-auto mt-16 w-full max-w-md">
        <Card className="border-slate-700 bg-slate-800/60 text-slate-100 shadow-2xl backdrop-blur-sm supports-[backdrop-filter]:bg-slate-800/40">
          <CardHeader className="space-y-1 border-b border-slate-700 pb-6">
            <div className="mb-2 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="myTenant Invoice" width={200} height={48} className="brightness-0 invert" />
            </div>
            <CardTitle className="text-center text-2xl font-bold tracking-tight">
              Platform Admin Console
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              Authorized personnel only - all access is audited
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">
                  Admin Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@platform.com"
                  disabled={isSubmitting}
                  className="border-slate-600 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary"
                  {...register('email')}
                />
                {errors.email ? (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">
                  Admin Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="border-slate-600 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary"
                  {...register('password')}
                />
                {errors.password ? (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/60 bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="default"
                className="w-full font-semibold tracking-wide shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Authenticating...' : 'Sign in as Admin'}
              </Button>
            </form>

            <div className="mt-8 border-t border-slate-700 pt-4 text-center text-xs text-slate-500">
              <p>Restricted access area. Unauthorized access is prohibited.</p>
              <p className="mt-1">All activities are logged and monitored.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminLoginPageInner(): React.ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginPageInner />
    </Suspense>
  );
}
