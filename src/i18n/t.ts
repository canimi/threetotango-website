import en from './en.json';

export function t(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      en,
    );
  if (typeof value === 'string') return value;
  if (import.meta.env.PROD) return key;
  throw new Error(`Missing i18n key: ${key}`);
}
