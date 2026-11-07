import type { CharacterId } from '../lib/episodes';

export interface Character {
  name: string;
  nickname: string;
  color: string;
  oneLiner: string;
  loves: string[];
  hates: string[];
  portrait: string;
  portraitPos: string;
  portraitZoom: number;
  /** Square close-up (cropped from the ref sheet), 400x400. */
  face: string;
  /** 3:4 seated/bust crop (cropped from the ref sheet), 600x800. */
  full: string;
}

export const characters: Record<CharacterId, Character> = {
  luka: {
    name: 'Luka',
    nickname: 'The Genius',
    color: 'var(--c-luka)',
    oneLiner: 'Solves every lock in the house. Still thinks your hand is a trap.',
    loves: ['High places', 'Solving problems', 'Attention, on her terms', 'Budy'],
    hates: ['Being petted uninvited', 'Traps (everything Nora does)', 'Being fooled'],
    portrait: '/img/refs/luka.webp',
    face: '/img/cast/luka-face.webp',
    full: '/img/cast/luka-full.webp',
    portraitPos: '92% 30%',
    portraitZoom: 1.8,
  },
  budy: {
    name: 'Budy',
    nickname: 'The Chatterbox',
    color: 'var(--c-budy)',
    oneLiner: 'Has an opinion about breakfast. Shares it. Continuously.',
    loves: ['Food', 'Lettuce', "Nora's lap", 'Luka', 'Talking'],
    hates: ['Empty bowls', 'Being ignored (looking at you, Caddy)'],
    portrait: '/img/refs/budy.webp',
    face: '/img/cast/budy-face.webp',
    full: '/img/cast/budy-full.webp',
    portraitPos: '82% 95%',
    portraitZoom: 1.8,
  },
  caddy: {
    name: 'Caddy',
    nickname: 'The Unbothered',
    color: 'var(--c-caddy)',
    oneLiner: 'Fifteen years old. Has seen it all. Is grooming through it.',
    loves: ['Her sheepskin rug', 'Sunbeams', 'Naps', 'Grooming'],
    hates: ['Play', "Budy's antics", 'Surprises'],
    portrait: '/img/refs/caddy.webp',
    face: '/img/cast/caddy-face.webp',
    full: '/img/cast/caddy-full.webp',
    portraitPos: '88% 95%',
    portraitZoom: 1.8,
  },
  nora: {
    name: 'Nora',
    nickname: 'The Human',
    color: 'var(--c-mustard)',
    oneLiner: 'Works from home. Loses every single round. Never raises her voice.',
    loves: ['Her cats', 'A quiet work block', 'Coffee'],
    hates: ['Nothing she would admit to', 'Mysterious silence from the kitchen'],
    portrait: '/img/refs/nora.webp',
    face: '/img/cast/nora-face.webp',
    full: '/img/cast/nora-full.webp',
    portraitPos: '85% 25%',
    portraitZoom: 1.2,
  },
};

export const characterIds: CharacterId[] = ['luka', 'budy', 'caddy', 'nora'];
export const filterIds: CharacterId[] = ['luka', 'budy', 'caddy'];
