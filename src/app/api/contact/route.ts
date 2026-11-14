import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withErrorHandler } from '@/lib/api/with-error-handler';
import { RateLimitError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { emailAdapter } from '@/server/integrations/email-adapter';

/** Where contact messages land. Kept next to the form copy for consistency. */
const CONTACT_INBOX = 'hello@cromstelit.com';

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(1).max(5_000),
  /** Honeypot: humans never see this field; bots fill it. */
  company: z.string().optional(),
});

const WINDOW_MS = 15 * 60 * 1_000;
const MAX_PER_WINDOW = 3;

/** In-memory limiter: adequate for a single-instance marketing server. */
const hits = new Map<string, number[]>();

function isRateLimited(ip: string, now: number): number {
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    const oldest = recent[0] ?? now;
    return Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1_000));
  }

  recent.push(now);
  hits.set(ip, recent);

  for (const [key, times] of hits) {
    if (times.every((time) => now - time >= WINDOW_MS)) {
      hits.delete(key);
    }
  }

  return 0;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export const POST = withErrorHandler(async (request: unknown) => {
  const req = request as NextRequest;
  const now = Date.now();
  const ip = clientIp(req);
  const retryAfterSec = isRateLimited(ip, now);

  if (retryAfterSec > 0) {
    throw new RateLimitError(retryAfterSec);
  }

  const parsed = contactSchema.safeParse(await req.json());

  if (!parsed.success) {
    throw parsed.error;
  }

  const { name, email, message, company } = parsed.data;

  // Honeypot hit: reply success without sending anything.
  if (company) {
    return NextResponse.json({ data: { received: true } }, { status: 202 });
  }

  if (!emailAdapter.isConfigured()) {
    return NextResponse.json(
      { error: { code: 'EMAIL_UNAVAILABLE', message: 'Email delivery is not configured.' } },
      { status: 503 },
    );
  }

  const subject = `Contact form: ${name}`;
  const body = `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message}</p>`;

  await emailAdapter.sendEmail({
    to: CONTACT_INBOX,
    subject,
    html: body,
    text: `From: ${name} <${email}>\n\n${message}`,
    replyTo: email,
  });

  logger.info({ ip }, 'Contact form submission delivered');

  return NextResponse.json({ data: { received: true } }, { status: 202 });
});
