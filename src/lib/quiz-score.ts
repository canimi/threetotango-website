import { questions, quizCats, type QuizCat, type QuizQuestion } from '../data/quiz';

/** Tie-break order is the order of `quizCats`: luka > budy > caddy. */
export function scoreQuiz(answerIdx: number[], qs: QuizQuestion[] = questions): QuizCat {
  if (answerIdx.length !== qs.length) {
    throw new Error(`Expected ${qs.length} answers, got ${answerIdx.length}`);
  }
  const totals: Record<QuizCat, number> = { luka: 0, budy: 0, caddy: 0 };
  answerIdx.forEach((idx, i) => {
    const answer = Number.isInteger(idx) ? qs[i].answers[idx] : undefined;
    if (!answer) throw new Error(`Answer index out of range for question ${i}: ${idx}`);
    for (const cat of quizCats) totals[cat] += answer.weights[cat] ?? 0;
  });
  return quizCats.reduce((best, cat) => (totals[cat] > totals[best] ? cat : best), quizCats[0]);
}

/**
 * Reads the inline-quiz first answer from a query string (`?start=<answerIdx>`).
 * Returns the answer index for question 1, or null if missing or out of range.
 */
export function parseStart(search: string, qs: QuizQuestion[] = questions): number | null {
  const raw = new URLSearchParams(search).get('start');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const idx = Number(raw);
  return qs.length > 0 && idx < qs[0].answers.length ? idx : null;
}
