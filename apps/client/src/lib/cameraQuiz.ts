import config from '../../../server/src/content/camera-quiz.json';
export { config as quizConfig };
export type QuizIntent = 'RENT' | 'BUY';
export type QuizPurpose = keyof typeof config.purposes;
export type QuizAnswers = { intent: QuizIntent; purpose: QuizPurpose; maxBudgetVnd: number | null };
export type QuizMatch = {
  slug: string;
  name: string;
  brand: string;
  thumbnailUrl: string | null;
  priceVnd: number;
  unitId: number;
  reason: string;
};
export type QuizRecommendation = QuizAnswers & {
  purposeLabel: string;
  emptyReason: 'NO_MATCH' | 'OVER_BUDGET' | null;
  minimumMatchingPrice: number | null;
  concertAdvice: string | null;
  matches: QuizMatch[];
};
