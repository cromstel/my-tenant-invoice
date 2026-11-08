export const REDACT_KEYS: Set<string> = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'password_confirm',
  'secret',
  'sk_',
  'pk_',
  'api_key',
  'token',
  'client_secret',
  'card_number',
  'cvc',
  'ssn',
  'creditcard',
  'cvv',
  'pin',
]);

const MAX_DEPTH = 6;
const REDACTED = '[REDACTED]';
const MAX_DEPTH_MARKER = '[redacted: max depth]';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively walks an object/array tree and replaces the values of any key
 * whose (lowercased) name appears in REDACT_KEYS with "[REDACTED]".
 *
 * Guards:
 *  - Max recursion depth 6 (deeper nodes return a depth marker)
 *  - Circular references tracked via WeakSet
 *  - Only plain objects recurse (Date, Map, Set, Buffer etc. pass through)
 *
 * @param obj   - Any value to walk
 * @param depth - Current recursion depth (defaults to 0)
 */
export function redact(obj: unknown, depth: number = 0): unknown {
  if (depth > MAX_DEPTH) return MAX_DEPTH_MARKER;

  if (Array.isArray(obj)) {
    const visited = new WeakSet<object>();
    return obj.map((item) => redactInternal(item, depth + 1, visited));
  }

  if (isPlainObject(obj)) {
    const visited = new WeakSet<object>();
    return redactObject(obj, depth, visited);
  }

  return obj;
}

function redactInternal(value: unknown, depth: number, visited: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return MAX_DEPTH_MARKER;

  if (Array.isArray(value)) {
    if (visited.has(value)) return null;
    visited.add(value);
    return value.map((item) => redactInternal(item, depth + 1, visited));
  }

  if (isPlainObject(value)) {
    return redactObject(value, depth, visited);
  }

  return value;
}

function redactObject(
  obj: Record<string, unknown>,
  depth: number,
  visited: WeakSet<object>,
): Record<string, unknown> {
  if (visited.has(obj)) return {} as Record<string, unknown>;
  visited.add(obj);

  const result: Record<string, unknown> = {};
  const entries = Object.entries(obj);

  for (const [key, value] of entries) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = redactInternal(value, depth + 1, visited);
    }
  }

  return result;
}
