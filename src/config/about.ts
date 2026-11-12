import {
  Boxes,
  Calculator,
  HeartHandshake,
  Layers,
  type LucideIcon,
  Network,
  PencilRuler,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';

export interface CompanyValue {
  /** Stable identifier, used for anchors and test selectors. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export interface TeamPod {
  /** Stable identifier, used for anchors and test selectors. */
  readonly id: string;
  readonly name: string;
  /** One line describing what the pod owns. */
  readonly remit: string;
  readonly focus: readonly string[];
  /** Path of the portrait, relative to the public directory. */
  readonly image: string;
  readonly imageAlt: string;
  readonly icon: LucideIcon;
}

export interface CompanyFact {
  readonly label: string;
  readonly value: string;
  /** Absolute link target, when the fact points at something external. */
  readonly href?: string;
}

/**
 * The four commitments the product is held to.
 *
 * These expand the short list the page carried before. Each one restates
 * something the codebase actually enforces, so the wording stays separable
 * from anything aspirational.
 */
export const companyValues: readonly CompanyValue[] = [
  {
    id: 'security-first',
    title: 'Security first',
    description:
      'Tenant isolation is enforced in the database and checked again on every request, not just hidden in the interface. A record that belongs to another organisation is not reachable, whatever the caller asks for.',
    icon: ShieldCheck,
  },
  {
    id: 'accuracy',
    title: 'Accuracy',
    description:
      'Money is stored as exact decimals and never as floating point. Rounding happens once, at a defined point in the calculation, so a statement totals the same way every time it is recalculated.',
    icon: Calculator,
  },
  {
    id: 'transparency',
    title: 'Transparency',
    description:
      'Every state change that matters writes an audit entry recording who acted, on what and when. Reports are built from the same records the interface shows, so a figure can always be traced back to its source.',
    icon: ScrollText,
  },
  {
    id: 'simplicity',
    title: 'Simplicity',
    description:
      'One data model covers buildings, leases, meters, tariffs and invoices. Fewer moving parts means fewer places for a number to go missing between the meter reading and the payment.',
    icon: Layers,
  },
];

/**
 * The teams that build and run the product, described by function.
 *
 * Deliberately no names, headcounts, offices or portraits of real people:
 * none of that is recorded anywhere in this repository, and inventing it
 * would put a claim on a public page that nobody can stand behind. Each pod
 * carries an illustrated portrait instead, so the section still reads as a
 * team without asserting an identity.
 */
export const teamPods: readonly TeamPod[] = [
  {
    id: 'platform-engineering',
    name: 'Platform Engineering',
    remit: 'Tenancy, the data model, and the service layer every feature runs on.',
    focus: [
      'Tenant isolation and schema',
      'Prisma models and migrations',
      'Background queues and jobs',
    ],
    image: '/team/platform-engineering.png',
    imageAlt: '',
    icon: Boxes,
  },
  {
    id: 'product-design',
    name: 'Product & Design',
    remit: 'The workflows people follow, and the documentation that explains them.',
    focus: [
      'Billing and billing-adjacent workflows',
      'Accessible interface patterns',
      'Guides and release notes',
    ],
    image: '/team/product-design.png',
    imageAlt: '',
    icon: PencilRuler,
  },
  {
    id: 'security-compliance',
    name: 'Security & Compliance',
    remit: 'Access control, auditability, and the security posture of the platform.',
    focus: [
      'Authentication and sessions',
      'Roles and permission checks',
      'Audit logging and disclosure',
    ],
    image: '/team/security-compliance.png',
    imageAlt: '',
    icon: ShieldCheck,
  },
  {
    id: 'billing-engineering',
    name: 'Billing Engineering',
    remit: 'Rating, rounding, and the invoice lifecycle from draft to payment.',
    focus: [
      'Flat, tiered and block rating',
      'Decimal money and rounding rules',
      'Invoice states, voiding and reconciliation',
    ],
    image: '/team/billing-engineering.png',
    imageAlt: '',
    icon: Calculator,
  },
  {
    id: 'integrations',
    name: 'Integrations & API',
    remit: 'The REST API, the outbound webhooks, and the contracts behind both.',
    focus: [
      'Permission-checked REST endpoints',
      'HMAC-signed webhooks',
      'Report and export formats',
    ],
    image: '/team/integrations.png',
    imageAlt: '',
    icon: Network,
  },
  {
    id: 'customer-success',
    name: 'Customer Success',
    remit: 'Onboarding, tariff configuration, and the day-to-day support queue.',
    focus: ['Organisation onboarding', 'Tariff and meter setup', 'Support and escalation'],
    image: '/team/customer-success.png',
    imageAlt: '',
    icon: HeartHandshake,
  },
];

/**
 * Facts about the company and the product, all of them checkable.
 *
 * Everything here is either stated in the repository's own metadata or
 * published on a page that already ships. Certification claims, customer
 * counts, headcounts and founding dates are absent on purpose.
 */
export const companyFacts: readonly CompanyFact[] = [
  { label: 'Product', value: 'myTenant Invoice' },
  { label: 'Built by', value: 'CromStel IT Group', href: 'https://cromstelit.com' },
  {
    label: 'General enquiries',
    value: 'hello@cromstelit.com',
    href: 'mailto:hello@cromstelit.com',
  },
  {
    label: 'Security reports',
    value: 'security@cromstelit.com',
    href: 'mailto:security@cromstelit.com',
  },
  { label: 'Code', value: 'github.com/cromstel', href: 'https://github.com/cromstel' },
  { label: 'Platform', value: 'Next.js App Router, React and TypeScript, with MySQL and Prisma' },
  { label: 'Licence', value: 'Proprietary commercial licence' },
];
