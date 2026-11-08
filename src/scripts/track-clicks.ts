import { classifyLink, track } from '../lib/track';

// One delegated listener for all pages: social links and CTAs into Tango Me.
document.addEventListener(
  'click',
  (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const ev = classifyLink(a.getAttribute('href') ?? '', location.pathname, location.origin);
    if (ev) track(ev.name, { ...ev.data, from: location.pathname.slice(0, 60) });
  },
  { capture: true },
);
