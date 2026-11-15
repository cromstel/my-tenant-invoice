import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create your myTenant Invoice organization and start billing in minutes.',
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
