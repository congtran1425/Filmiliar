import { z } from 'zod';
import config from '../content/camera-quiz.json';

export const quizSchema = z
  .object({
    intent: z.enum(['RENT', 'BUY']),
    purpose: z.enum(['TRAVEL', 'PORTRAIT', 'VIDEO', 'CONCERT', 'LEARNING']),
    maxBudgetVnd: z.number().int().positive().max(1_000_000_000).nullable(),
  })
  .strict();
export type QuizAnswers = z.infer<typeof quizSchema>;
export type QuizProduct = {
  id: number;
  slug: string;
  modelName: string;
  brand: string;
  categoryName: string;
  isPublished: boolean;
  recommendedPurpose: string;
  dailyRentalRate: number;
  referenceUsedPrice: bigint | number;
  thumbnailUrl: string | null;
  units: { id: number; status: string }[];
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export function recommendCameras(products: QuizProduct[], answers: QuizAnswers) {
  const validUnits = (product: QuizProduct) =>
    product.units.filter(
      (unit) =>
        Number.isSafeInteger(unit.id) &&
        unit.id > 0 &&
        (answers.intent === 'BUY'
          ? unit.status === 'AVAILABLE'
          : ['AVAILABLE', 'RESERVED', 'RENTED'].includes(unit.status)),
    );
  const price = (product: QuizProduct) =>
    answers.intent === 'RENT' ? product.dailyRentalRate : Number(product.referenceUsedPrice);
  const purpose = config.purposes[answers.purpose];
  const eligible = products.filter(
    (product) =>
      product.isPublished &&
      !['lens', 'ong kinh'].includes(normalize(product.categoryName)) &&
      validUnits(product).length > 0 &&
      Number.isSafeInteger(price(product)) &&
      price(product) > 0,
  );
  // Match catalog phrases as words, not arbitrary substrings or a hard-coded first product.
  const fits = eligible
    .filter((product) =>
      purpose.tags.some((tag) =>
        ` ${normalize(product.recommendedPurpose).replace(/[^a-z0-9]+/g, ' ')} `.includes(` ${tag} `),
      ),
    )
    .sort((a, b) => price(a) - price(b) || a.id - b.id);
  const affordable = fits.filter(
    (product) => answers.maxBudgetVnd === null || price(product) <= answers.maxBudgetVnd,
  );
  const emptyReason = affordable.length ? null : !fits.length ? 'NO_MATCH' : 'OVER_BUDGET';
  return {
    intent: answers.intent,
    purpose: answers.purpose,
    purposeLabel: purpose.label,
    maxBudgetVnd: answers.maxBudgetVnd,
    emptyReason,
    minimumMatchingPrice: emptyReason === 'OVER_BUDGET' ? price(fits[0]) : null,
    concertAdvice:
      answers.purpose === 'CONCERT'
        ? 'Chọn ống kính theo vị trí chụp và kiểm tra quy định mang máy của sự kiện.'
        : null,
    matches: affordable.slice(0, 3).map((product) => {
      const units = validUnits(product).sort(
        (a, b) => Number(b.status === 'AVAILABLE') - Number(a.status === 'AVAILABLE') || a.id - b.id,
      );
      return {
        slug: product.slug,
        name: product.modelName,
        brand: product.brand,
        thumbnailUrl: product.thumbnailUrl,
        priceVnd: price(product),
        unitId: units[0].id,
        reason: `Danh mục gợi ý cho ${purpose.label.toLocaleLowerCase('vi-VN')}.`,
      };
    }),
  };
}
