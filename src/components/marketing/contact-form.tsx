'use client';

import { useState } from 'react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('sending');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });

      if (!response.ok) {
        throw new Error(`Contact endpoint returned ${response.status}`);
      }

      form.reset();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate={false}>
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      {/* Honeypot field: visually hidden and skipped by keyboard and screen readers. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          maxLength={5000}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="How can we help?"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
      <p aria-live="polite" className="text-sm">
        {status === 'sent' && (
          <span className="text-green-600">Thank you — your message has been sent.</span>
        )}
        {status === 'error' && (
          <span className="text-red-600">
            Something went wrong. Please email hello@cromstelit.com directly.
          </span>
        )}
      </p>
    </form>
  );
}
