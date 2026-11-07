import { z } from 'zod';

export const PasswordStrengthSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((p) => /[a-z]/.test(p), 'Password must contain a lowercase letter')
  .refine((p) => /[A-Z]/.test(p), 'Password must contain an uppercase letter')
  .refine((p) => /\d/.test(p), 'Password must contain a number')
  .refine((p) => /[^a-zA-Z0-9]/.test(p), 'Password must contain a special character');

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';
  suggestions: string[];
}

/**
 * Evaluates password strength on a 0-4 scale.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Mix uppercase and lowercase letters');

  if (/\d/.test(password)) score++;
  else suggestions.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else suggestions.push('Add special characters');

  const clamped = Math.min(score, 4) as PasswordStrengthResult['score'];
  const labels: PasswordStrengthResult['label'][] = [
    'very-weak',
    'weak',
    'fair',
    'strong',
    'very-strong',
  ];

  return {
    score: clamped,
    label: labels[clamped] ?? 'very-weak',
    suggestions,
  };
}
