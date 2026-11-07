import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { rateLimit } from 'express-rate-limit';
import { quizSchema, recommendCameras } from '../services/camera-quiz.js';

export function registerQuizRoutes(app: Express, prisma: PrismaClient) {
  const limit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, message: 'Bạn thử lại sau một phút nhé.' } });
  app.post('/api/quiz/recommend', limit, async (req, res) => {
    const parsed = quizSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, message: 'Chọn thuê hoặc mua, nhu cầu và ngân sách để nhận gợi ý.' });
    try {
      const products = await prisma.product.findMany({
        where: {
          isPublished: true,
          NOT: { categoryName: { equals: 'Lens', mode: 'insensitive' } },
          units: {
            some: {
              status: {
                in: parsed.data.intent === 'BUY' ? ['AVAILABLE'] : ['AVAILABLE', 'RESERVED', 'RENTED'],
              },
            },
          },
        },
        select: {
          id: true,
          slug: true,
          modelName: true,
          brand: true,
          categoryName: true,
          isPublished: true,
          recommendedPurpose: true,
          dailyRentalRate: true,
          referenceUsedPrice: true,
          thumbnailUrl: true,
          units: { select: { id: true, status: true } },
        },
      });
      res.json({ success: true, recommendation: recommendCameras(products, parsed.data) });
    } catch {
      res.status(503).json({ success: false, message: 'Chưa tải được danh mục gợi ý. Vui lòng thử lại.' });
    }
  });
}
