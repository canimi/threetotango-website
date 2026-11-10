// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderCard, applyLike, setLoadError } from '../src/lib/gallery';

const item = { id: 'abc', name: '<b>x</b>', img: '/media/tango/abc-post.jpg', likes: 3 };

describe('renderCard', () => {
  it('renders the name as text, not HTML', () => {
    const card = renderCard(item, false);
    expect(card.querySelector('b')).toBeNull();
    expect(card.textContent).toContain('<b>x</b>');
  });
  it('links to the share page and sets image attributes', () => {
    const card = renderCard(item, false);
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/tango-me/r/abc');
    const img = card.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBeTruthy();
    expect(img.getAttribute('alt')).toBe("<b>x</b>, a Tango Me guest of Nora's cats");
  });
  it('heart button reflects liked state', () => {
    const btn = renderCard(item, true).querySelector('button')!;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Like <b>x</b>');
  });
});

describe('applyLike', () => {
  const setup = () => {
    const card = renderCard(item, true);
    return card;
  };
  it('rolls back when the image was removed', () => {
    const card = setup();
    applyLike(card, { ok: false, error: 'invalid' }, 3);
    expect(card.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
    expect(card.querySelector('.count')!.textContent).toBe('3');
  });
  it('shows the server count on success and keeps it filled', () => {
    const card = setup();
    applyLike(card, { ok: true, likes: 9, already: true }, 3);
    expect(card.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
    expect(card.querySelector('.count')!.textContent).toBe('9');
  });
  it('rolls back on limit', () => {
    const card = setup();
    applyLike(card, { ok: false, error: 'limit' }, 3);
    expect(card.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
    expect(card.querySelector('.count')!.textContent).toBe('3');
  });
});

describe('setLoadError', () => {
  it('shows and clears the napping message', () => {
    const el = document.createElement('p');
    setLoadError(el, true);
    expect(el.textContent).toBe('The gallery is napping. Try again in a minute.');
    setLoadError(el, false);
    expect(el.textContent).toBe('');
  });
});
