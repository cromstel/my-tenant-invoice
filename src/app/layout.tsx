import '../styles/globals.css';

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { cn } from '@/lib/utils';

// The font files are committed under app/fonts rather than downloaded from
// Google at build time. That keeps the build independent of network access,
// and it means dev can never quietly fall back to a system font when the
// network is briefly unavailable. Each file is the latin variable subset, so
// one file per family covers every weight the product uses. Their licenses
// sit beside them.
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin-variable.woff2',
  variable: '--font-jetbrains-mono',
  weight: '100 800',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'myTenant Invoice',
    template: '%s · myTenant Invoice',
  },
  description:
    'myTenant Invoice - Production-grade SaaS multi-tenant invoicing and property billing management platform by CromStel IT Group.',
  keywords: [
    'invoice',
    'billing',
    'property management',
    'tenant',
    'multi-tenant',
    'SaaS',
    'accounts receivable',
    'CromStel IT Group',
  ],
  authors: [
    {
      name: 'CromStel IT Group',
      url: 'https://cromstelit.com',
    },
  ],
  creator: 'CromStel IT Group',
  publisher: 'CromStel IT Group',
  metadataBase: new URL('https://mytenant.cromstelit.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mytenant.cromstelit.com',
    title: 'myTenant Invoice',
    description:
      'Production-grade SaaS multi-tenant invoicing and property billing management platform.',
    siteName: 'myTenant Invoice',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'myTenant Invoice - Tenant Billing Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'myTenant Invoice',
    description:
      'Production-grade SaaS multi-tenant invoicing and property billing management platform.',
    images: ['/og.png'],
    creator: '@cromstelit',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1f' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactNode {
  return (
    <html
      lang="en"
      className={cn(
        inter.variable,
        jetbrainsMono.variable,
        'min-h-screen bg-background font-sans antialiased',
      )}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
