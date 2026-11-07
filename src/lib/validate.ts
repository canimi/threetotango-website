const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(s: string): boolean {
  return s.length <= 254 && EMAIL_RE.test(s);
}

export const isValidCode = (s: string): boolean => /^\d{6}$/.test(s);

/** Strip every non-digit so pasted "123 456" or "123-456" still works. */
export const normalizeCode = (s: string): string => s.replace(/\D/g, '');
