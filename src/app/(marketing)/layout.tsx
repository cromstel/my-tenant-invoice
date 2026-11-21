import Link from 'next/link';

import { Wordmark } from '@/components/brand/wordmark';
import { SiteHeader } from '@/components/layout/site-header';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-2">
                <Link
                  href="/"
                  aria-label="myTenant Invoice home"
                  className="inline-flex min-h-11 items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Wordmark markClassName="size-6" nameClassName="text-base font-semibold" />
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Production-grade SaaS multi-tenant invoicing and property billing management
                platform.
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Product</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    href="/#features"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/solutions"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Solutions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Services
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/blog"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="/security"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Company</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    href="/about"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Legal</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    href="/privacy"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="flex min-h-11 items-center text-muted-foreground hover:text-foreground"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            Designed &amp; Developed by{' '}
            <a
              href="https://cromstelit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="-my-3 inline-block py-3 font-medium hover:text-foreground"
            >
              CromStel IT Group
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
