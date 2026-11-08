import { describe, expect, it, vi } from 'vitest';
import { classifyLink, track } from '../src/lib/track';

const O = 'https://threetotango.canimi.app';

describe('track', () => {
  it('does nothing when umami is missing', () => {
    expect(() => track('x', undefined, {})).not.toThrow();
  });
  it('swallows errors thrown by umami', () => {
    const w = { umami: { track: () => { throw new Error('boom'); } } };
    expect(() => track('x', { a: 1 }, w)).not.toThrow();
  });
  it('passes name and data to umami.track', () => {
    const fn = vi.fn();
    track('tango-start', { scene: 'box-fort' }, { umami: { track: fn } });
    expect(fn).toHaveBeenCalledWith('tango-start', { scene: 'box-fort' });
  });
  it('calls umami.track with name only when no data', () => {
    const fn = vi.fn();
    track('tango-done', undefined, { umami: { track: fn } });
    expect(fn).toHaveBeenCalledWith('tango-done');
  });
});

describe('classifyLink', () => {
  it('detects instagram and youtube', () => {
    expect(classifyLink('https://www.instagram.com/threetotangocats', '/', O)?.data.to).toBe('instagram');
    expect(classifyLink('https://www.youtube.com/@ThreeToTangoCats', '/', O)?.data.to).toBe('youtube');
  });
  it('detects tango-me CTAs with deep-link params', () => {
    expect(classifyLink('/tango-me?scene=box-fort', '/', O)).toEqual({ name: 'tango-cta', data: { scene: 'box-fort' } });
    expect(classifyLink('/tango-me?personality=genius', '/quiz/luka/', O)?.data).toEqual({ personality: 'genius' });
    expect(classifyLink('/tango-me', '/cats/', O)).toEqual({ name: 'tango-cta', data: {} });
  });
  it('ignores links on the tango-me page itself, share pages and other links', () => {
    expect(classifyLink('/tango-me', '/tango-me/', O)).toBeNull();
    expect(classifyLink('/tango-me/r/abc', '/', O)).toBeNull();
    expect(classifyLink('/episodes', '/', O)).toBeNull();
    expect(classifyLink('https://evil.example/tango-me', '/', O)).toBeNull();
    expect(classifyLink('http://[bad', '/', O)).toBeNull();
  });
});
