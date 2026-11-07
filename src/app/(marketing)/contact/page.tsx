export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Contact Us</h1>
      <p className="mb-8 text-muted-foreground">Have questions? We&apos;d love to hear from you.</p>
      <form className="space-y-6">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
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
            type="email"
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="message" className="mb-2 block text-sm font-medium">
            Message
          </label>
          <textarea
            id="message"
            rows={5}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="How can we help?"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Send Message
        </button>
      </form>
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>
          Or email us directly at{' '}
          <a href="mailto:hello@cromstelit.com" className="text-primary">
            hello@cromstelit.com
          </a>
        </p>
      </div>
    </div>
  );
}
