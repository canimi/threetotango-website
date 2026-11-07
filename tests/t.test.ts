import { it, expect } from 'vitest';
import { t } from '../src/i18n/t';

it('returns brand promise', () =>
  expect(t('brand.promise')).toBe('Nora lives her best life. Her three cats have other plans.'));
it('returns cta', () => expect(t('cta.tangoFree')).toBe('Tango me, free'));
it('throws on missing key in dev', () => expect(() => t('nope.key')).toThrow());
