import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient, ItemStatus, DepositStatus, Role, KycStatus } from '@prisma/client';
import { z } from 'zod';
import { uploadService } from './services/upload.service.js';
import { createSessionToken, getSessionUser, hashPassword, verifyPassword } from './auth.js';
import { registerPaymentRoutes } from './routes/payment.js';
import { parseRentalDates, PaymentFlowError } from './services/payment-flow.js';

dotenv.config();


const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
}

// Multer in-memory storage for handling file uploads before FTP transfer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.includes(origin) && req.path !== '/api/payment/callback') {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  next();
});
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(['/api/auth/login', '/api/auth/register'], rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Thử lại sau ít phút.' }
}));

// Serve local uploads in dev mode
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Helper to serialize BigInt
function serializeData(data: any): any {
  return JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ));
}

async function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = await getSessionUser(prisma, req);
  if (!user) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  res.locals.user = user;
  next();
}

function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.user?.role !== Role.ADMIN) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  next();
}


// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  let totalProducts = 0;
  try {
    totalProducts = await prisma.product.count();
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: 'ok',
    project: 'Filmiliar API',
    version: '1.0.0',
    database: {
      status: dbStatus,
      totalProductModels: totalProducts
    },
    storageMode: process.env.STORAGE_MODE || 'http_api'
  });
});

// 1. Lấy danh sách sản phẩm từ PostgreSQL Database
app.get('/api/cameras', async (req: Request, res: Response) => {
  try {
    const { brand, category } = req.query;

    const where: any = {};
    if (brand && brand !== 'ALL') {
      where.brand = { equals: String(brand), mode: 'insensitive' };
    }
    if (category) {
      where.categoryName = { equals: String(category), mode: 'insensitive' };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        units: true
      },
      orderBy: { id: 'asc' }
    });

    // Định dạng dữ liệu chuẩn cho giao diện Frontend
    const formatted = products.map((prod) => {
      const firstUnit = prod.units[0];
      return {
        id: `prod-${prod.id}`,
        name: prod.modelName,
        slug: prod.slug,
        brand: prod.brand,
        category: prod.categoryName,
        sensorType: prod.sensorType,
        resolutionMp: prod.resolutionMp,
        videoResolution: prod.videoSpecs || 'Chuẩn HD',
        hasIbis: prod.hasIbis,
        weightGram: prod.weightGrams,
        recommendedPurpose: prod.recommendedPurpose,
        thumbnailUrl: prod.thumbnailUrl,
        baseRentDailyPrice: prod.dailyRentalRate,
        baseSalePrice: Number(prod.referenceUsedPrice),
        conditionPercent: null,
        status: firstUnit?.status || null,
        currentShutter: firstUnit?.shutterCount ?? null,
        depositRequired: null,
        unitsCount: prod.units.length,
        passport: firstUnit ? {
          passportCode: `TP-${firstUnit.serialNumber}`,
          serialNumber: firstUnit.serialNumber,
          shutterCount: firstUnit.shutterCount || 0,
          sensorCondition: firstUnit.sensorInspection,
          opticsCondition: firstUnit.opticsCondition,
          cosmeticGrade: firstUnit.conditionGrade,
          scratchNotes: firstUnit.scratchNotes,
          technicianNotes: null,
          lastInspectedDate: null
        } : null
      };
    });

    res.json(serializeData({
      success: true,
      isDemo: process.env.DEMO_CATALOG === 'true',
      total: formatted.length,
      data: formatted
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi truy vấn CSDL: ' + error.message });
  }
});

// 2. Chi tiết sản phẩm & danh sách con máy
app.get('/api/cameras/:slug', async (req: Request, res: Response) => {
  try {
    const param = req.params.slug;
    const numId = param.startsWith('prod-')
      ? parseInt(param.replace('prod-', ''), 10)
      : (!isNaN(Number(param)) ? parseInt(param, 10) : null);

    const product = await prisma.product.findFirst({
      where: numId ? { OR: [{ id: numId }, { slug: param }] } : { slug: param },
      include: { units: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
    }

    res.json(serializeData({ success: true, isDemo: process.env.DEMO_CATALOG === 'true', data: product }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// 3. Tra cứu Technical Passport cụ thể theo Serial Number
app.get('/api/passport/:serial', async (req: Request, res: Response) => {
  try {
    const serial = req.params.serial.replace('TP-', '');
    const unit = await prisma.cameraItem.findUnique({
      where: { serialNumber: serial },
      include: { product: true }
    });

    if (!unit) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ kỹ thuật' });
    }

    res.json(serializeData({
      success: true,
      data: {
        cameraName: unit.product.modelName,
        brand: unit.product.brand,
        serialNumber: unit.serialNumber,
        passportCode: `TP-${unit.serialNumber}`,
        shutterCount: unit.shutterCount,
        conditionGrade: unit.conditionGrade,
        sensorCondition: unit.sensorInspection,
        opticsCondition: unit.opticsCondition,
        scratchNotes: unit.scratchNotes,
        depositAmount: unit.depositAmount,
        status: unit.status
      }
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Camera Match Quiz Recommendation Engine
app.post('/api/quiz/recommend', async (req: Request, res: Response) => {
  try {
    const { purpose, experienceLevel, budgetRange } = req.body;

    const allProducts = await prisma.product.findMany({
      include: { units: true }
    });

    let matchedProduct = allProducts[0];
    let action: 'RENT' | 'BUY' = 'RENT';
    let reason = '';

    if (purpose === 'CONCERT' || purpose === 'TRAVEL_SHORT') {
      action = 'RENT';
      // Match Sony A7 IV or Canon R6
      matchedProduct = allProducts.find(p => p.id === 1) || allProducts[0];
      reason = 'Nhu cầu đi concert hoặc du lịch ngắn hạn cần khả năng khử nhiễu ISO cao và lấy nét siêu nhanh. Thuê Sony A7 IV giúp bạn bắt trọn khoảnh khắc idol mà chi phí chỉ bằng 1/100 giá mua mới!';
    } else if (purpose === 'TIKTOK_VLOG') {
      action = 'RENT';
      // Match Canon R50 or Sony ZV-E10
      matchedProduct = allProducts.find(p => p.id === 3 || p.id === 6) || allProducts[2];
      reason = 'Sony ZV-E10 / Canon R50 cực kỳ nhỏ gọn (dưới 380g), màn hình lật xoay và micro thu âm tốt, là lựa chọn số 1 cho các bạn làm video TikTok, vlog du lịch.';
    } else if (purpose === 'LEARN_PHOTOGRAPHY' || experienceLevel === 'BEGINNER') {
      if (budgetRange === 'HIGH') {
        action = 'BUY';
        matchedProduct = allProducts.find(p => p.id === 4) || allProducts[3]; // Fuji X-T30 II
        reason = 'Fujifilm X-T30 II sở hữu các bộ lọc màu film giả lập huyền thoại, giúp bạn có ngay bức ảnh đậm chất điện ảnh mà không cần tốn thời gian học chỉnh sửa hậu kỳ.';
      } else {
        action = 'RENT';
        matchedProduct = allProducts.find(p => p.id === 6) || allProducts[5]; // Canon R50
        reason = 'Khuyên bạn nên thuê trải nghiệm Canon R50 trong 2-3 ngày để làm quen với thao tác máy ảnh trước khi đầu tư số tiền lớn để sở hữu.';
      }
    } else {
      matchedProduct = allProducts.find(p => p.id === 2) || allProducts[1]; // Sony A7 III
      reason = 'Bộ máy toàn diện, đáp ứng hoàn hảo cho chụp chân dung ngoại cảnh, kỷ yếu và sự kiện với chi phí thuê cực kỳ tiết kiệm.';
    }

    const firstUnit = matchedProduct.units[0];
    const formattedMatchedCamera = {
      id: `prod-${matchedProduct.id}`,
      name: matchedProduct.modelName,
      slug: matchedProduct.slug,
      brand: matchedProduct.brand,
      category: matchedProduct.categoryName,
      sensorType: matchedProduct.sensorType,
      videoResolution: matchedProduct.videoSpecs || '4K',
      weightGram: matchedProduct.weightGrams,
      thumbnailUrl: matchedProduct.thumbnailUrl,
      baseRentDailyPrice: matchedProduct.dailyRentalRate,
      baseSalePrice: Number(matchedProduct.referenceUsedPrice),
      conditionPercent: firstUnit ? (firstUnit.conditionGrade === 'A+' ? 99 : 98) : 98,
      depositRequired: firstUnit?.depositAmount || 2000000,
      currentShutter: firstUnit?.shutterCount || 0
    };

    res.json(serializeData({
      success: true,
      recommendation: {
        action,
        matchedCamera: formattedMatchedCamera,
        reason,
        adviceText: action === 'RENT'
          ? '💡 Gợi ý: Thuê trải nghiệm theo dịp giúp bạn tối ưu chi phí và luôn được cầm máy đã qua kiểm định mới nhất.'
          : '💡 Gợi ý: Máy second-hand tại Filmiliar đi kèm Hộ chiếu kỹ thuật và bảo hành 6 tháng an tâm tuyệt đối.'
      }
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Tính giá thuê và cọc
app.post('/api/rentals/calculate', async (req: Request, res: Response) => {
  try {
    const { cameraId, startDate, endDate } = req.body;
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({ success: false, message: 'Ngày thuê không hợp lệ' });
    }
    const { days: diffDays } = parseRentalDates(startDate, endDate);
    const numId = parseInt(String(cameraId).replace('prod-', ''));
    if (!Number.isSafeInteger(numId) || numId <= 0 || !/^(?:prod-)?\d+$/.test(String(cameraId))) {
      return res.status(400).json({ success: false, message: 'Mã thiết bị không hợp lệ' });
    }

    const product = await prisma.product.findUnique({
      where: { id: numId },
      include: { units: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
    }

    const totalRentalFee = diffDays * product.dailyRentalRate;
    res.json({
      success: true,
      data: {
        cameraName: product.modelName,
        dailyRate: product.dailyRentalRate,
        totalDays: diffDays,
        totalRentalFee,
        depositAmount: null,
        totalPaymentInitial: null,
        depositRefundPolicy: null,
        policyStatus: 'Chính sách đặt cọc và hoàn cọc chưa được nhóm chốt.'
      }
    });
  } catch (error: any) {
    if (error instanceof PaymentFlowError) return res.status(error.statusCode).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Media Upload endpoint
app.post('/api/upload', requireUser, requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  if (process.env.ENABLE_UPLOADS !== 'true') {
    return res.status(403).json({ success: false, message: 'Chức năng tải ảnh chưa khả dụng' });
  }
  next();
}, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file để tải lên' });
    }

    const subFolder = req.body.subFolder || 'cameras';
    if (subFolder !== 'cameras' && subFolder !== 'passports') {
      return res.status(400).json({ success: false, message: 'Thư mục ảnh không hợp lệ' });
    }
    const uploadResult = await uploadService.uploadFile(req.file, subFolder);

    res.json({
      success: true,
      message: 'Tải và tối ưu hóa file thành công',
      data: uploadResult
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tải file: ' + error.message
    });
  }
});

// ==========================================
// 7. ZALOPAY PAYMENT ENDPOINTS
// ==========================================

// The Sandbox API is admin-only and remains off unless the host opts in explicitly.
registerPaymentRoutes(app, prisma, requireUser, requireAdmin);

// ==========================================
// 8. USER & AUTH ENDPOINTS
// ==========================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone } = req.body;
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 128 || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 120 || (phone != null && (typeof phone !== 'string' || phone.length > 30))) {
      return res.status(400).json({ success: false, message: 'Thông tin đăng ký không hợp lệ; mật khẩu cần ít nhất 10 ký tự.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã được đăng ký' });
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        role: Role.CUSTOMER,
        kycStatus: KycStatus.UNVERIFIED
      }
    });

    const token = createSessionToken(user);

    res.json(serializeData({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        kycStatus: user.kycStatus
      }
    }));
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tạo tài khoản lúc này' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128 || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = createSessionToken(user);

    res.json(serializeData({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        kycStatus: user.kycStatus
      }
    }));
  } catch {
    res.status(500).json({ success: false, message: 'Không thể đăng nhập lúc này' });
  }
});

app.get('/api/auth/me', requireUser, (_req: Request, res: Response) => {
  const user = res.locals.user;
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      role: user.role,
      kycStatus: user.kycStatus
    }
  });
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullable(),
  address: z.string().trim().max(500).nullable()
}).strict();

app.put('/api/user/profile', requireUser, async (req: Request, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Thông tin hồ sơ không hợp lệ' });
  try {
    const user = await prisma.user.update({
      where: { id: res.locals.user.id },
      data: {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null
      }
    });
    res.json({ success: true, user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, address: user.address, role: user.role, kycStatus: user.kycStatus } });
  } catch {
    res.status(500).json({ success: false, message: 'Không thể cập nhật hồ sơ lúc này' });
  }
});

app.put('/api/user/change-password', requireUser, async (req: Request, res: Response) => {
  const parsed = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128)
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Mật khẩu mới cần từ 10 đến 128 ký tự' });
  const { currentPassword, newPassword } = parsed.data;
  if (!verifyPassword(currentPassword, res.locals.user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
  }
  try {
    const user = await prisma.user.update({
      where: { id: res.locals.user.id },
      data: { passwordHash: hashPassword(newPassword) }
    });
    res.json({ success: true, token: createSessionToken(user) });
  } catch {
    res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu lúc này' });
  }
});

// Public image hosting is not suitable for identity documents.
app.post('/api/user/kyc', requireUser, (_req: Request, res: Response) => {
  res.status(503).json({ success: false, message: 'Filmiliar chưa tiếp nhận giấy tờ định danh trực tuyến.' });
});

app.get('/api/user/rentals', requireUser, async (_req: Request, res: Response) => {
  try {
    const bookings = await prisma.rentalBooking.findMany({
      where: { userId: res.locals.user.id },
      include: {
        cameraItem: {
          include: { product: true }
        },
        paymentAttempt: { select: { status: true, appTransId: true, reviewReason: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json(serializeData({ success: true, data: bookings }));
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải đơn thuê lúc này' });
  }
});

app.get('/api/user/orders', requireUser, async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: res.locals.user.id },
      include: { cameraItem: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(serializeData({ success: true, data: orders }));
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải đơn mua lúc này' });
  }
});

// ==========================================
// 9. ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Lấy tất cả đơn thuê
app.get('/api/admin/bookings', requireUser, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const bookings = await prisma.rentalBooking.findMany({
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, kycStatus: true } },
        cameraItem: {
          include: { product: true }
        },
        paymentAttempt: { select: { status: true, appTransId: true, reviewReason: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(serializeData({ success: true, data: bookings }));
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải đơn thuê lúc này' });
  }
});

app.patch('/api/admin/bookings/:id/status', requireUser, requireAdmin, (_req: Request, res: Response) => {
  res.status(503).json({ success: false, message: 'Chưa có quy trình xác nhận, bàn giao và đối soát cọc.' });
});

// Thống kê tổng quan cho Admin
app.get('/api/admin/stats', requireUser, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const totalModels = await prisma.product.count();
    const totalUnits = await prisma.cameraItem.count();
    const availableUnits = await prisma.cameraItem.count({ where: { status: ItemStatus.AVAILABLE } });
    const rentedUnits = await prisma.cameraItem.count({ where: { status: ItemStatus.RENTED } });
    const totalBookings = await prisma.rentalBooking.count();
    const totalHeldDeposit = await prisma.rentalBooking.aggregate({
      _sum: { depositAmount: true },
      where: { depositStatus: DepositStatus.HELD, paymentAttempt: { is: null } }
    });
    const sandboxHeldDeposit = await prisma.rentalBooking.aggregate({
      _sum: { depositAmount: true },
      where: { depositStatus: DepositStatus.HELD, paymentAttempt: { is: { status: 'PAID' } } }
    });

    res.json({
      success: true,
      stats: {
        totalModels,
        totalUnits,
        availableUnits,
        rentedUnits,
        totalBookings,
        heldDepositAmount: totalHeldDeposit._sum.depositAmount || 0,
        sandboxHeldDepositAmount: sandboxHeldDeposit._sum.depositAmount || 0,
        utilizationRate: totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0
      }
    });
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải thống kê lúc này' });
  }
});

app.get('/api/admin/inventory', requireUser, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.cameraItem.findMany({
      include: { product: { select: { id: true, modelName: true, slug: true, brand: true } } },
      orderBy: { serialNumber: 'asc' },
      take: 200
    });
    res.json(serializeData({ success: true, data: items }));
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải kho máy lúc này' });
  }
});

const inventorySchema = z.object({
  shutterCount: z.number().int().min(0).max(10000000).nullable().optional(),
  conditionGrade: z.string().trim().min(1).max(16).optional(),
  sensorInspection: z.string().trim().max(500).nullable().optional(),
  opticsCondition: z.string().trim().min(1).max(500).optional(),
  scratchNotes: z.string().trim().max(500).optional()
}).strict().refine((value) => Object.keys(value).length > 0);

app.patch('/api/admin/inventory/:serial', requireUser, requireAdmin, async (req: Request, res: Response) => {
  const parsed = inventorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Dữ liệu thiết bị không hợp lệ' });
  try {
    const item = await prisma.cameraItem.update({
      where: { serialNumber: req.params.serial },
      data: parsed.data,
      include: { product: { select: { modelName: true, slug: true, brand: true } } }
    });
    res.json(serializeData({ success: true, data: item }));
  } catch {
    res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị hoặc không thể cập nhật' });
  }
});

app.get('/api/admin/users', requireUser, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, fullName: true, phone: true, role: true,
        kycStatus: true, createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ success: true, data: users });
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải người dùng lúc này' });
  }
});

app.patch('/api/admin/users/:id/kyc', requireUser, requireAdmin, (_req: Request, res: Response) => {
  res.status(503).json({ success: false, message: 'Chưa có quy trình lưu trữ và duyệt giấy tờ định danh.' });
});

// Start Server
app.listen(PORT, () => {

  console.log(`===============================================`);
  console.log(`🎬 Filmiliar Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📷 Camera Catalog: http://localhost:${PORT}/api/cameras`);
  console.log(`===============================================`);
});
