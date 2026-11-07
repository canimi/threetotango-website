export type QuizCat = 'luka' | 'budy' | 'caddy';

export interface QuizAnswer {
  text: string;
  weights: Partial<Record<QuizCat, number>>;
}

export interface QuizQuestion {
  id: string;
  text: string;
  answers: QuizAnswer[];
}

export const quizCats: QuizCat[] = ['luka', 'budy', 'caddy'];

export const questions: QuizQuestion[] = [
  {
    id: 'bag',
    text: 'Someone opens a bag in the kitchen. You...',
    answers: [
      { text: 'Check who it is, what is in it, and what they want from me.', weights: { luka: 2 } },
      { text: 'Arrive before the zipper stops. Is that for me? It is for me.', weights: { budy: 2 } },
      { text: 'Hear it. Decide it is a future problem. Keep resting.', weights: { caddy: 2 } },
    ],
  },
  {
    id: 'party',
    text: 'At a party, you are most likely to be...',
    answers: [
      { text: 'On the highest available surface, observing.', weights: { luka: 2 } },
      { text: 'Telling a stranger my whole week. They did not ask.', weights: { budy: 2 } },
      { text: 'Already home, in my head and soon in person.', weights: { caddy: 2 } },
    ],
  },
  {
    id: 'text',
    text: 'A friend texts "quick question". You...',
    answers: [
      { text: 'Assume it is a trap and reply in four to six hours.', weights: { luka: 2 } },
      { text: 'Call them back immediately. Texting is for cowards.', weights: { budy: 2 } },
      { text: 'Reply Thursday. Maybe.', weights: { caddy: 2 } },
    ],
  },
  {
    id: 'saturday',
    text: 'Your perfect Saturday is...',
    answers: [
      { text: 'Solving something nobody asked me to solve.', weights: { luka: 2 } },
      { text: 'Brunch, then a second brunch, with people.', weights: { budy: 2 } },
      { text: 'A sunbeam, a blanket, and zero plans.', weights: { caddy: 2 } },
    ],
  },
  {
    id: 'hug',
    text: 'Someone tries to hug you without warning. You...',
    answers: [
      { text: 'Allow it for exactly three seconds, on my terms.', weights: { luka: 2 } },
      { text: 'Hug back. Stay a while. Maybe lean in.', weights: { budy: 2 } },
      { text: 'Go limp and wait for it to be over.', weights: { caddy: 2 } },
    ],
  },
  {
    id: 'fridge',
    text: 'It is 11 pm and you are in front of the fridge. You...',
    answers: [
      { text: 'Am not hungry. I just wanted to see if the door still opens.', weights: { luka: 2 } },
      { text: 'Narrate every option out loud. Then eat three of them.', weights: { budy: 2 } },
      { text: 'Fall asleep on the way there. The fridge can wait.', weights: { caddy: 2 } },
    ],
  },
  {
    id: 'surprise',
    text: 'Your plans suddenly change. You...',
    answers: [
      { text: 'Knew. I always have a backup. And a backup for the backup.', weights: { luka: 2 } },
      { text: 'Tell everyone. Loudly. Several times.', weights: { budy: 2 } },
      { text: 'Quietly refuse to participate. Tidy my hair.', weights: { caddy: 2 } },
    ],
  },
];
