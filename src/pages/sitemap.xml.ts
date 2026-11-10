import type { APIRoute } from 'astro';
import { characterIds } from '../data/characters';
import { quizCats } from '../data/quiz';
import { getEpisodes } from '../lib/site-episodes';

/** Build-time sitemap of every public page (episode pages included). /links is the Instagram bio page and is left out. */
export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://threetotango.canimi.app')).origin;
  const episodes = await getEpisodes();
  const paths = [
    '/',
    '/tango-me/',
    '/cats/',
    ...characterIds.map((id) => `/cats/${id}/`),
    '/episodes/',
    ...episodes.map((e) => `/episodes/${e.slug}/`),
    '/gallery/',
    '/quiz/',
    ...quizCats.map((id) => `/quiz/${id}/`),
    '/gift/',
    '/behind-the-scenes/',
    '/privacy/',
    '/contact/',
  ];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
