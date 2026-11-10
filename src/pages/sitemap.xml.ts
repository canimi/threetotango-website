import type { APIRoute } from 'astro';
import { characterIds } from '../data/characters';
import { quizCats } from '../data/quiz';
import { getEpisodes } from '../lib/site-episodes';

/** Build-time sitemap of every public page (episode pages included). /links is the Instagram bio page and is left out. */
export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://threetotango.canimi.app')).origin;
  const episodes = await getEpisodes();
  // Canonical URLs have no trailing slash (nginx 301s the slash variant); the home page is "/".
  const entries: { path: string; lastmod?: string }[] = [
    { path: '/', lastmod: episodes[0]?.publishedAt },
    { path: '/tango-me' },
    { path: '/cats' },
    ...characterIds.map((id) => ({ path: `/cats/${id}` })),
    { path: '/episodes', lastmod: episodes[0]?.publishedAt },
    ...episodes.map((e) => ({ path: `/episodes/${e.slug}`, lastmod: e.publishedAt })),
    { path: '/gallery' },
    { path: '/quiz' },
    ...quizCats.map((id) => ({ path: `/quiz/${id}` })),
    { path: '/gift' },
    { path: '/behind-the-scenes' },
    { path: '/privacy' },
    { path: '/contact' },
  ];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map((u) => {
        const day = u.lastmod && !Number.isNaN(Date.parse(u.lastmod)) ? u.lastmod.slice(0, 10) : '';
        return `  <url><loc>${esc(base + u.path)}</loc>${day ? `<lastmod>${day}</lastmod>` : ''}</url>`;
      })
      .join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
