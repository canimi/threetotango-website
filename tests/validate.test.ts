import { describe, it, expect } from 'vitest';
import { isValidEmail } from '../src/lib/validate';

describe('isValidEmail', () => {
  it('accepts a normal address', () => expect(isValidEmail('a@b.co')).toBe(true));
  it.each(['a@b', '', 'a b@c.com', '@b.co', 'a@.co'])('rejects %j', (s) =>
    expect(isValidEmail(s)).toBe(false),
  );
});
