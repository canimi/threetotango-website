import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { scoreQuiz } from '../src/lib/quiz-score';
import { questions, type QuizQuestion } from '../src/data/quiz';

type Id = 'luka' | 'budy' | 'caddy';
const fixture = (n = 3): QuizQuestion[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    text: `Q${i}`,
    answers: [
      { text: 'a', weights: { luka: 1 } },
      { text: 'b', weights: { budy: 1 } },
      { text: 'c', weights: { caddy: 1 } },
    ],
  }));

describe('scoreQuiz', () => {
  const qs = fixture();
  it.each([
    ['luka', 0],
    ['budy', 1],
    ['caddy', 2],
  ] as [Id, number][])('all-%s answers give %s', (id, idx) => {
    expect(scoreQuiz(qs.map(() => idx), qs)).toBe(id);
  });

  it('breaks exact ties as luka > budy > caddy', () => {
    expect(scoreQuiz([0, 1, 2], qs)).toBe('luka');
    expect(scoreQuiz([1, 2, 2, 1], fixture(4))).toBe('budy');
    expect(scoreQuiz([2, 1], fixture(2))).toBe('budy');
  });

  it('throws on wrong length', () => {
    expect(() => scoreQuiz([0, 1], qs)).toThrow();
  });

  it('throws on out-of-range or non-integer index', () => {
    expect(() => scoreQuiz([0, 0, 3], qs)).toThrow();
    expect(() => scoreQuiz([0, -1, 0], qs)).toThrow();
    expect(() => scoreQuiz([0, 0.5, 0], qs)).toThrow();
  });
});

describe('real quiz data', () => {
  it('has 7 questions with 3+ answers each', () => {
    expect(questions).toHaveLength(7);
    for (const q of questions) expect(q.answers.length).toBeGreaterThanOrEqual(3);
  });
  it('every cat is reachable by picking its answers throughout', () => {
    for (const id of ['luka', 'budy', 'caddy'] as Id[]) {
      const picks = questions.map((q) =>
        q.answers.reduce((best, a, i) => ((a.weights[id] ?? 0) > (q.answers[best].weights[id] ?? 0) ? i : best), 0),
      );
      expect(scoreQuiz(picks)).toBe(id);
    }
  });
});

describe('built quiz pages', () => {
  const read = (p: string) => readFileSync(join('dist', p), 'utf8');
  it('quiz index renders a start state', () => {
    const h = read('quiz/index.html');
    expect(h).toContain('data-start-btn');
    expect(h).toContain('Seven questions');
  });
  it.each(['luka', 'budy', 'caddy'])('result page %s has OG image, card link and CTA', (id) => {
    const h = read(`quiz/${id}/index.html`);
    expect(h).toContain(`/img/quiz/${id}-og.jpg`);
    expect(h).toContain(`/img/quiz/${id}-card.jpg`);
    expect(h).toContain('href="/tango-me"');
    expect(h).toContain('href="/quiz"');
  });
  it('has no nora result', () => {
    expect(existsSync(join('dist', 'quiz/nora/index.html'))).toBe(false);
  });
});
