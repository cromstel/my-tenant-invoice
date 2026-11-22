export interface Feature {
  readonly title: string;
  readonly desc: string;
}

/**
 * Feature set rendered by the landing page's Key Features section. Copy is
 * limited to shipped capabilities — see the claims policy in
 * src/config/services.ts.
 */
export const features: readonly Feature[] = [
  {
    title: 'Multi-Tenancy',
    desc: 'Complete data isolation for each organization with independent configurations, branding, and billing rules.',
  },
  {
    title: 'Smart Billing Engine',
    desc: 'Flexible tariff engine supporting flat-rate, tiered, and block pricing models.',
  },
  {
    title: 'Property Management',
    desc: 'Manage properties, buildings, units, and occupancy tracking with flexible hierarchy.',
  },
  {
    title: 'Lease Management',
    desc: 'Track leases, deposits and recurring charges; occupancy updates automatically at lease start and end, with day-based proration.',
  },
  {
    title: 'Meter Management',
    desc: 'Track utility meters, readings, and consumption with automated anomaly detection.',
  },
  {
    title: 'Invoice Lifecycle',
    desc: 'Full invoice workflow from draft to payment with approval, dispatch, and voiding.',
  },
  {
    title: 'Payment Processing',
    desc: 'Record payments, allocate to invoices, process refunds, and reconcile accounts.',
  },
  {
    title: 'Financial Reports',
    desc: 'Revenue, aging, consumption, and occupancy reports with export capabilities.',
  },
  {
    title: 'Audit Logging',
    desc: 'Comprehensive audit trail for all critical actions and changes.',
  },
  {
    title: 'Role-Based Access',
    desc: 'Granular permissions with platform, organization, and client roles.',
  },
  {
    title: 'Notifications',
    desc: 'Email, in-app, and webhook notifications for billing events.',
  },
  {
    title: 'API & Automation',
    desc: 'Permission-checked REST endpoints, background queues across the billing cycle, and HMAC-signed outbound webhooks.',
  },
];
