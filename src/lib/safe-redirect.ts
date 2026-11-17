/**
 * Returns a same-origin relative path safe for client-side navigation, or
 * the fallback when the value is absent or could leave the origin:
 * absolute URLs, protocol-relative `//`, backslash-prefixed paths, and
 * control characters are all rejected.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex -- intentional: reject control characters
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
