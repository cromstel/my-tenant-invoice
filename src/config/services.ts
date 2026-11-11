import {
  Building2,
  CreditCard,
  FileSignature,
  Gauge,
  Layers,
  type LucideIcon,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Users,
  Webhook,
} from 'lucide-react';

export interface ServiceLine {
  /** Stable identifier, used for anchors and test selectors. */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly capabilities: readonly string[];
  /** Path of the illustration, relative to the public directory. */
  readonly image: string;
  readonly imageAlt: string;
  readonly icon: LucideIcon;
}

/**
 * The six service lines the platform delivers.
 *
 * Every capability listed here is implemented in the service layer under
 * `src/server/services`. Claims that the code does not support are
 * deliberately absent: the tenant portal is still a placeholder, the AI
 * assistant is behind a disabled feature flag, time-of-use and seasonal
 * rating exist only as enum values, and invoice dispatch currently logs
 * rather than sends.
 */
export const serviceLines: readonly ServiceLine[] = [
  {
    id: 'property-portfolio',
    title: 'Property & Portfolio Management',
    summary:
      'Model your estate as properties, buildings and units, and keep occupancy accurate at every level.',
    capabilities: [
      'Properties, buildings and units held in one hierarchy',
      'Occupancy per unit: occupied, vacant, reserved or under maintenance',
      'Portfolio grouping with owner, manager and unit counts',
      'Estate-wide occupancy reporting',
    ],
    image: '/illustrations/services-property-portfolio.png',
    imageAlt:
      'A tall building divided into individual units, some filled and some empty, beside a stack of portfolio cards.',
    icon: Building2,
  },
  {
    id: 'lease-management',
    title: 'Lease Management',
    summary:
      'Run the tenancy from signed agreement to renewal, with the unit occupancy kept in step automatically.',
    capabilities: [
      'Deposits, recurring charges and service agreements recorded per lease',
      'A unit turns occupied when the lease starts and vacant when it ends',
      'Renewals, move-out dates and billing windows',
      'Day-based proration for part billing periods',
    ],
    image: '/illustrations/services-lease-management.png',
    imageAlt:
      'A lease agreement with a signature beside a calendar of dates and a key, linked by a dotted arc.',
    icon: FileSignature,
  },
  {
    id: 'meter-consumption',
    title: 'Meter & Consumption Billing',
    summary:
      'Capture utility readings and turn consumption into billable charges, with anomalies caught before they reach an invoice.',
    capabilities: [
      'A meter registry for electricity, water, gas, heat and cooling',
      'Readings from manual entry, bulk import, an API or smart meters',
      'Automatic detection of negative readings, meter resets and consumption spikes',
      'Period consumption computed from the meter multiplier',
    ],
    image: '/illustrations/services-meter-consumption.png',
    imageAlt:
      'A utility meter beside a consumption chart in which one unusually tall reading is highlighted and flagged.',
    icon: Gauge,
  },
  {
    id: 'tariff-engine',
    title: 'Tariff & Rating Engine',
    summary:
      'Price every service with versioned tariffs, so a rate change never rewrites what was already billed.',
    capabilities: [
      'A service catalogue with packages that bundle multiple billable services',
      'Effective-dated tariff versions that resolve to the rate in force on a given day',
      'Flat rate, tiered, block, standing charge, percentage, minimum and maximum charge',
      'Decimal arithmetic throughout, so totals never drift',
    ],
    image: '/illustrations/services-tariff-engine.png',
    imageAlt:
      'A ladder of pricing tiers widening upwards beside a vertical rate slider, over concentric calculation arcs.',
    icon: Layers,
  },
  {
    id: 'invoicing',
    title: 'Invoicing & Recurring Billing',
    summary: 'Take an invoice from draft to sent, on a schedule, without re-keying a single line.',
    capabilities: [
      'Per-organisation invoice numbering with a configurable prefix',
      'Line items with quantity, unit price, per-item tax and proration flags',
      'A controlled lifecycle: draft, approved, sent, voided or cancelled',
      'Scheduled recurring runs across active leases, with late fees and discounts',
    ],
    image: '/illustrations/services-invoicing.png',
    imageAlt:
      'An invoice sheet with line items and a total, beside a looping arrow that represents recurring billing.',
    icon: ReceiptText,
  },
  {
    id: 'payments',
    title: 'Payments, Reconciliation & Collections',
    summary:
      'Take the money, apply it against the right invoices, and know exactly what is still owed.',
    capabilities: [
      'Idempotent payment recording, so a replayed webhook never double-posts',
      'One payment allocated across several invoices',
      'Partial and full refunds, tracked against the original payment',
      'Receivables aging buckets and collection-rate reporting',
    ],
    image: '/illustrations/services-payments.png',
    imageAlt:
      'A payment card sending a single payment down to settle three separate invoices, each marked as settled.',
    icon: CreditCard,
  },
];

export interface PlatformPrinciple {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

/** The guarantees that sit underneath every service line. */
export const platformPrinciples: readonly PlatformPrinciple[] = [
  {
    title: 'Database-level tenant isolation',
    description:
      'Every read and write is scoped to the organisation in the database layer, not by a filter in application code.',
    icon: ShieldCheck,
  },
  {
    title: 'Role-based access control',
    description:
      'Platform, organisation admin, accountant and tenant roles, enforced server-side on every route and action.',
    icon: Users,
  },
  {
    title: 'A complete audit trail',
    description:
      'Every create, void, refund and termination is written with its actor, organisation and payload.',
    icon: ScrollText,
  },
  {
    title: 'An API and automation backbone',
    description:
      'Permission-checked REST endpoints, background queues for the whole billing cycle, and HMAC-signed outbound webhooks.',
    icon: Webhook,
  },
];

export interface PlatformStat {
  readonly value: string;
  readonly label: string;
  readonly detail: string;
}

/** Verifiable counts, taken from the source rather than from marketing copy. */
export const platformStats: readonly PlatformStat[] = [
  {
    value: '41',
    label: 'tenant-scoped models',
    detail: 'protected by database-level isolation on every query',
  },
  {
    value: '10',
    label: 'REST endpoints',
    detail: 'each permission-checked and schema-validated',
  },
  {
    value: '9',
    label: 'background queues',
    detail: 'covering invoices, PDFs, email, reminders, imports, exports and webhooks',
  },
  {
    value: '7',
    label: 'pricing models',
    detail: 'in the tariff engine, from a flat rate to tiered blocks',
  },
];
