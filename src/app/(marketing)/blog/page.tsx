import Link from 'next/link';

const blogPosts = [
  {
    slug: 'getting-started-with-mytenant-invoice',
    title: 'Getting Started with myTenant Invoice',
    excerpt:
      'Learn how to set up your organization, add properties, and create your first invoice.',
    date: '2026-11-01',
    category: 'Guide',
  },
  {
    slug: 'understanding-tariff-types',
    title: 'Understanding Tariff Types',
    excerpt: 'A comprehensive guide to flat-rate, tiered, block, and time-of-use tariffs.',
    date: '2026-10-28',
    category: 'Billing',
  },
  {
    slug: 'meter-anomaly-detection',
    title: 'How Meter Anomaly Detection Works',
    excerpt: 'Learn how our system automatically detects unusual meter readings.',
    date: '2026-10-20',
    category: 'Meters',
  },
  {
    slug: 'tenant-data-isolation',
    title: 'Tenant Data Isolation in SaaS',
    excerpt: 'How we ensure complete data separation between organizations.',
    date: '2026-10-15',
    category: 'Security',
  },
];

export default function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Blog</h1>
      <p className="mb-12 max-w-2xl text-muted-foreground">
        Insights, guides, and updates from the myTenant Invoice team.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        {blogPosts.map((post) => (
          <article key={post.slug} className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                {post.category}
              </span>
              <span className="text-xs text-muted-foreground">{post.date}</span>
            </div>
            <h2 className="mb-2 text-xl font-semibold">{post.title}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{post.excerpt}</p>
            <Link
              href={`/blog/${post.slug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Read more →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
