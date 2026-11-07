/**
 * Feature flags for toggling functionality.
 * In production, these could be sourced from a database or config service.
 */
export const FEATURE_FLAGS = {
  AI_ASSISTANT: false,
  WEBHOOKS: true,
  API_KEYS: true,
  CUSTOM_BRANDING: true,
  MULTI_CURRENCY: false,
  RECURRING_BILLING: true,
  METER_ANOMALY_DETECTION: true,
  SUPPORT_TICKETS: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
