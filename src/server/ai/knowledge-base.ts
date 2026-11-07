export const knowledgeBase = [
  {
    id: 'kb-001',
    category: 'billing',
    question: 'How is my invoice total calculated?',
    answer:
      'Your invoice total is calculated by summing all line items. Each line item amount is quantity x unit price. Tax is applied per line item based on the tax rate. Discounts and credits are then subtracted from the subtotal to get the final total.',
  },
  {
    id: 'kb-002',
    category: 'billing',
    question: 'What is a prorated charge?',
    answer:
      'A prorated charge is a partial charge for a service that covers only part of a billing period. For example, if you move in mid-month, your rent is prorated for the days you occupied the unit.',
  },
  {
    id: 'kb-003',
    category: 'tariffs',
    question: 'What tariff types are supported?',
    answer:
      'We support flat-rate, tiered, block, time-of-use, peak, off-peak, standing charge, seasonal, percentage, minimum charge, and maximum charge tariffs.',
  },
  {
    id: 'kb-004',
    category: 'tariffs',
    question: 'How do tiered tariffs work?',
    answer:
      'Tiered tariffs charge different rates for different consumption bands. For example, the first 100 units might be charged at $0.10/unit, and units above 100 at $0.15/unit.',
  },
  {
    id: 'kb-005',
    category: 'payments',
    question: 'How can I pay my invoice?',
    answer:
      'You can pay through the client portal using credit/debit card, bank transfer, or other configured payment methods. Contact your property manager for specific payment options.',
  },
  {
    id: 'kb-006',
    category: 'payments',
    question: 'What happens if I overpay?',
    answer:
      'Overpayments are recorded as credits on your account and can be applied to future invoices or refunded.',
  },
  {
    id: 'kb-007',
    category: 'meters',
    question: 'How are meter readings used?',
    answer:
      'Meter readings are used to calculate consumption (difference between current and previous reading). Consumption is then multiplied by the applicable tariff rate to determine charges.',
  },
  {
    id: 'kb-008',
    category: 'meters',
    question: 'What is an anomaly detection alert?',
    answer:
      'Anomaly detection flags unusual readings such as negative values, decreased readings (possible meter reset), or consumption spikes (more than 10x normal). These are flagged for review.',
  },
  {
    id: 'kb-009',
    category: 'leases',
    question: 'What happens when a lease ends?',
    answer:
      'When a lease ends, the unit occupancy status is updated to vacant. Final invoices are generated for any outstanding charges. Historical data is preserved.',
  },
  {
    id: 'kb-010',
    category: 'general',
    question: 'How do I contact support?',
    answer:
      'You can submit a support ticket through the client portal or contact your organization administrator directly.',
  },
];

export function searchKnowledgeBase(query: string): typeof knowledgeBase {
  const lowerQuery = query.toLowerCase();
  return knowledgeBase.filter(
    (kb) =>
      kb.question.toLowerCase().includes(lowerQuery) ||
      kb.answer.toLowerCase().includes(lowerQuery) ||
      kb.category.toLowerCase().includes(lowerQuery),
  );
}
