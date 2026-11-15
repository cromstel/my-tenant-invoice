import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Platform admin log in',
  description: 'Restricted sign-in for platform administrators.',
  robots: { index: false },
};

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
