import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
const isConfigured = vi.fn();

vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => null }));

vi.mock('@/lib/config/env', () => {
  const env = { NODE_ENV: 'test', LOG_LEVEL: 'error' };
  return { default: env, env, isDev: false, isProd: false, isTest: true };
});

vi.mock('@/server/integrations/email-adapter', () => ({
  emailAdapter: {
    sendEmail: (...args: unknown[]) => sendEmail(...args),
    isConfigured: (...args: unknown[]) => isConfigured(...args),
  },
}));

/** The limiter keeps in-process state, so the route module is re-imported per test. */
async function importRoute() {
  vi.resetModules();
  const route = await import('@/app/api/contact/route');
  return route.POST as (request: unknown) => Promise<Response>;
}

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost:6161/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ id: 'test-id' });
    isConfigured.mockReset();
    isConfigured.mockReturnValue(true);
  });

  it('rejects an invalid payload with 400', async () => {
    const POST = await importRoute();
    const response = await POST(jsonRequest({ name: '', email: 'nope', message: '' }));

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('accepts a honeypot hit without sending any email', async () => {
    const POST = await importRoute();
    const response = await POST(
      jsonRequest({ name: 'Bot', email: 'bot@example.com', message: 'spam', company: 'SpamCo' }),
    );

    expect(response.status).toBe(202);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends a valid submission to the contact inbox', async () => {
    const POST = await importRoute();
    const response = await POST(
      jsonRequest({ name: 'Ada', email: 'ada@example.com', message: 'Hello there' }),
    );

    expect(response.status).toBe(202);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hello@cromstelit.com',
        replyTo: 'ada@example.com',
      }),
    );
  });

  it('reports honestly when email delivery is not configured', async () => {
    isConfigured.mockReturnValue(false);

    const POST = await importRoute();
    const response = await POST(
      jsonRequest({ name: 'Ada', email: 'ada@example.com', message: 'Hello there' }),
    );

    expect(response.status).toBe(503);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rate limits the fourth submission from one client', async () => {
    const POST = await importRoute();
    const payload = { name: 'Ada', email: 'ada@example.com', message: 'Hello there' };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await POST(jsonRequest(payload));
      expect(response.status).toBe(202);
    }

    const limited = await POST(jsonRequest(payload));
    expect(limited.status).toBe(429);
  });
});
