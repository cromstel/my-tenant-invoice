import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Server configuration error',
    description:
      'There is a problem with the server configuration. Please contact support if this issue persists.',
  },
  AccessDenied: {
    title: 'Access denied',
    description:
      'You do not have permission to sign in. Please request an invitation from your organization administrator.',
  },
  Verification: {
    title: 'Unable to verify request',
    description: 'The sign-in request could not be verified. Please try again.',
  },
  Default: {
    title: 'Authentication error',
    description:
      'An unexpected error occurred during sign-in. Please try again, or contact support if the problem continues.',
  },
};

function getError(errorKey: string | undefined): {
  title: string;
  description: string;
} {
  if (errorKey) {
    const mapped = ERROR_MESSAGES[errorKey];
    if (mapped) {
      return mapped;
    }
  }
  const fallback = ERROR_MESSAGES.Default;
  if (fallback) {
    return fallback;
  }
  return {
    title: 'Authentication error',
    description:
      'An unexpected error occurred during sign-in. Please try again, or contact support if the problem continues.',
  };
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps): Promise<React.ReactNode> {
  const params = await searchParams;
  const errorKey = params?.error;
  const error = getError(errorKey);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-destructive/30 bg-card p-10 shadow-lg">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{error.title}</h1>
            <p className="text-muted-foreground">{error.description}</p>

            {errorKey ? (
              <p className="pt-2 font-mono text-xs text-muted-foreground/70">
                Error code: {errorKey}
              </p>
            ) : null}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Link
              href="/auth/login"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Return to sign in
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go to homepage
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
