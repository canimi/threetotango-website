import type { CharacterId } from '../lib/episodes';

export interface Character {
  name: string;
  nickname: string;
  color: string;
  oneLiner: string;
  loves: string[];
  hates: string[];
  portrait: string;
  gif: string;
}

export const characters: Record<CharacterId, Character> = {
  luka: {
    name: 'Luka',
    nickname: 'The Genius',
    color: 'var(--c-luka)',
    oneLiner: 'Solves every lock in the house. Still thinks your hand is a trap.',
    loves: ['High places', 'Solving problems', 'Attention, on her terms', 'Budy'],
    hates: ['Being petted uninvited', 'Traps (everything Nora does)', 'Being fooled'],
    portrait: '/img/cats/luka.webp',
    gif: '/img/cats/luka.gif',
  },
  budy: {
    name: 'Budy',
    nickname: 'The Chatterbox',
    color: 'var(--c-budy)',
    oneLiner: 'Has an opinion about breakfast. Shares it. Continuously.',
    loves: ['Food', 'Lettuce', "Nora's lap", 'Luka', 'Talking'],
    hates: ['Empty bowls', 'Being ignored (looking at you, Caddy)'],
    portrait: '/img/cats/budy.webp',
    gif: '/img/cats/budy.gif',
  },
  caddy: {
    name: 'Caddy',
    nickname: 'The Unbothered',
    color: 'var(--c-caddy)',
    oneLiner: 'Fifteen years old. Has seen it all. Is grooming through it.',
    loves: ['Her sheepskin rug', 'Sunbeams', 'Naps', 'Grooming'],
    hates: ['Play', "Budy's antics", 'Surprises'],
    portrait: '/img/cats/caddy.webp',
    gif: '/img/cats/caddy.gif',
  },
  nora: {
    name: 'Nora',
    nickname: 'The Human',
    color: 'var(--c-mustard)',
    oneLiner: 'Works from home. Loses every single round. Never raises her voice.',
    loves: ['Her cats', 'A quiet work block', 'Coffee'],
    hates: ['Nothing she would admit to', 'Mysterious silence from the kitchen'],
    portrait: '/img/cats/nora.webp',
    gif: '/img/cats/nora.gif',
  },
};

export const characterIds: CharacterId[] = ['luka', 'budy', 'caddy', 'nora'];
export const filterIds: CharacterId[] = ['luka', 'budy', 'caddy'];
