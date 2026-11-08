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
import { authClient } from '@/lib/auth-client';

const loginFormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof loginFormSchema>;

function LoginForm(): React.ReactNode {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(loginFormSchema),
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
        setError('Invalid email or password. Please try again.');
        return;
      }

      router.push(callbackUrl);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
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

            <CardTitle className="text-center text-2xl font-bold">Sign in to myTenant</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  disabled={isSubmitting}
                  {...register('email')}
                />
                {errors.email ? (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/auth/forgot-password"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  {...register('password')}
                />
                {errors.password ? (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a
                href="/auth/signup"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Create one
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginPageInner(): React.ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
