import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient, ItemStatus, DepositStatus, Role, KycStatus, BookingStatus, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { uploadService } from './services/upload.service.js';
import { createSessionToken, getSessionUser, hashPassword, verifyPassword } from './auth.js';
import { registerPaymentRoutes } from './routes/payment.js';
import { registerRentalRoutes } from './routes/rental.js';
import { normalizePhone } from './phone.js';
import { registerAccountSecurityRoutes } from './routes/account-security.js';
import { parseRentalDates, PaymentFlowError } from './services/payment-flow.js';
import { quoteRental, lockUnit } from './services/rental-availability.js';

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

// These workflows need approved policies, private identity storage and provider reconciliation.
// Keep draft handlers unavailable until each contract and its integration tests are in place.
function requireApprovedAdminWorkflow(_req: Request, res: Response) {
  return res.status(503).json({ success: false, message: 'Quy trình này đang chờ chính sách và bước đối soát được duyệt.' });
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
    revision: process.env.APP_REVISION || 'development',
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

    const where: any = { isPublished: true };
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
      // Match Sony Alpha A6700 or Fujifilm X-T50
      matchedProduct = allProducts.find(p => p.slug === 'sony-alpha-a6700') || allProducts[0];
      reason = 'Nhu cầu đi concert hoặc du lịch sự kiện cần khả năng lấy nét AI nhận diện chủ thể cực nhạy và chống rung mạnh mẽ. Thuê Sony Alpha A6700 giúp bạn bắt trọn từng khoảnh khắc idol mà chi phí chỉ bằng 1/100 giá mua mới!';
    } else if (purpose === 'TIKTOK_VLOG') {
      action = 'RENT';
      // Match Sony ZV-E10 or Canon EOS M50
      matchedProduct = allProducts.find(p => p.slug === 'sony-zv-e10' || p.slug === 'canon-eos-m50') || allProducts[0];
      reason = 'Sony ZV-E10 / Canon EOS M50 cực kỳ nhỏ gọn (dưới 390g), màn hình lật xoay selfie và tính năng làm đẹp da / Product Showcase, là lựa chọn số 1 cho các bạn làm video TikTok, vlog du lịch.';
    } else if (purpose === 'LEARN_PHOTOGRAPHY' || experienceLevel === 'BEGINNER') {
      if (budgetRange === 'HIGH') {
        action = 'BUY';
        matchedProduct = allProducts.find(p => p.slug === 'fujifilm-x-t50' || p.slug === 'fujifilm-x-t30-ii') || allProducts[0];
        reason = 'Dòng máy Fujifilm sở hữu các bộ lọc màu film giả lập huyền thoại, giúp bạn có ngay bức ảnh đậm chất điện ảnh mà không cần tốn thời gian học chỉnh sửa hậu kỳ.';
      } else {
        action = 'RENT';
        matchedProduct = allProducts.find(p => p.slug === 'canon-eos-m50' || p.slug === 'fujifilm-x-t100' || p.slug === 'nikon-z30') || allProducts[0];
        reason = 'Khuyên bạn nên thuê trải nghiệm Canon EOS M50 / Nikon Z30 trong 2-3 ngày để làm quen với thao tác máy ảnh trước khi đầu tư số tiền lớn để sở hữu.';
      }
    } else {
      matchedProduct = allProducts.find(p => p.slug === 'fujifilm-x-s10' || p.slug === 'canon-eos-r50') || allProducts[0];
      reason = 'Bộ máy toàn diện có chống rung cảm biến IBIS, đáp ứng hoàn hảo cho chụp chân dung ngoại cảnh, kỷ yếu và du lịch với chi phí thuê cực kỳ tiết kiệm.';
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
    const { cameraItemId, startDate, endDate } = req.body;
    if (typeof startDate !== 'string' || typeof endDate !== 'string' || !Number.isSafeInteger(cameraItemId) || cameraItemId <= 0) {
      return res.status(400).json({ success: false, message: 'Cần chọn chiếc máy cụ thể cùng ngày nhận và trả' });
    }
    const quote = await quoteRental(prisma, cameraItemId, startDate, endDate);
    res.json({ success: true, data: { ...quote.view, cameraName: quote.unit.product.modelName,
      totalRentalFee: quote.view.rentalFee, totalPaymentInitial: quote.view.totalAmount, depositRefundPolicy: quote.policy.terms } });
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

// Sandbox checkout is available to signed-in customers when the host enables it.
registerPaymentRoutes(app, prisma, requireUser, requireAdmin);
registerRentalRoutes(app, prisma, requireUser, requireAdmin);
registerAccountSecurityRoutes(app, prisma, requireUser);

// ==========================================
// 8. USER & AUTH ENDPOINTS
// ==========================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone } = req.body;
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại hợp lệ, ví dụ 0912345678 hoặc +84 912345678.' });
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 128 || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 120) {
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
        phone: normalizedPhone,
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
  phone: z.string().transform(normalizePhone).refine(value => value !== null, 'Vui lòng nhập số điện thoại hợp lệ'),
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
        phone: parsed.data.phone,
        address: parsed.data.address || null
      }
    });
    res.json({ success: true, user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, address: user.address, role: user.role, kycStatus: user.kycStatus } });
  } catch {
    res.status(500).json({ success: false, message: 'Không thể cập nhật hồ sơ lúc này' });
  }
});

// Tiếp nhận hồ sơ định danh eKYC từ người dùng
app.post('/api/user/kyc', requireUser, requireApprovedAdminWorkflow, async (req: Request, res: Response) => {
  const parsed = z.object({
    idCardNumber: z.string().trim().regex(/^\d{9,12}$/, 'Số CCCD/CMND phải gồm 9 đến 12 chữ số'),
    idCardFrontUrl: z.string().trim().optional().nullable(),
    idCardBackUrl: z.string().trim().optional().nullable(),
    eSignatureUrl: z.string().trim().optional().nullable()
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Dữ liệu eKYC không hợp lệ' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: res.locals.user.id },
      data: {
        idCardNumber: parsed.data.idCardNumber,
        idCardFrontUrl: parsed.data.idCardFrontUrl || null,
        idCardBackUrl: parsed.data.idCardBackUrl || null,
        eSignatureUrl: parsed.data.eSignatureUrl || null,
        kycStatus: KycStatus.PENDING
      }
    });

    res.json({
      success: true,
      message: 'Đã gửi hồ sơ eKYC thành công, quản trị viên sẽ thẩm định trong thời gian sớm nhất',
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        kycStatus: updated.kycStatus,
        idCardNumber: updated.idCardNumber
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật hồ sơ eKYC: ' + error.message });
  }
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

// Lấy danh sách đơn thuê kèm bộ lọc tìm kiếm
app.get('/api/admin/bookings', requireUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, q } = req.query;
    const where: any = {};

    if (typeof status === 'string' && Object.values(BookingStatus).includes(status as BookingStatus)) {
      where.status = status as BookingStatus;
    }

    if (typeof q === 'string' && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { bookingCode: { contains: term, mode: 'insensitive' } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { phone: { contains: term, mode: 'insensitive' } } },
        { cameraItem: { serialNumber: { contains: term, mode: 'insensitive' } } }
      ];
    }

    const bookings = await prisma.rentalBooking.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            address: true,
            kycStatus: true
          }
        },
        cameraItem: {
          include: { product: true }
        },
        paymentAttempt: {
          select: { status: true, appTransId: true, reviewReason: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(serializeData({ success: true, data: bookings }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Không thể tải đơn thuê: ' + error.message });
  }
});

const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  depositStatus: z.nativeEnum(DepositStatus).optional(),
  returnInspectionNote: z.string().trim().max(1000).optional(),
  shutterCountAtReturn: z.number().int().min(0).max(10000000).optional(),
  sensorInspection: z.string().trim().max(500).optional(),
  opticsCondition: z.string().trim().max(500).optional(),
  scratchNotes: z.string().trim().max(500).optional(),
  conditionGrade: z.string().trim().max(16).optional(),
  deductionAmount: z.number().int().min(0).optional(),
  deductionReason: z.string().trim().max(500).optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Cần ít nhất một trường thông tin để cập nhật'
});

// Cập nhật trạng thái đơn thuê, bàn giao máy, nghiệm thu kỹ thuật và đối soát hoàn cọc
app.patch('/api/admin/bookings/:id/status', requireUser, requireAdmin, requireApprovedAdminWorkflow, async (req: Request, res: Response) => {
  const parsed = updateBookingStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Dữ liệu cập nhật đơn thuê không hợp lệ'
    });
  }

  try {
    const booking = await prisma.rentalBooking.findUnique({
      where: { id: req.params.id },
      include: { cameraItem: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    const nextStatus = parsed.data.status ?? booking.status;
    const nextDepositStatus = parsed.data.depositStatus ?? booking.depositStatus;

    let finalInspectionNote = parsed.data.returnInspectionNote ?? booking.returnInspectionNote ?? '';
    if (parsed.data.deductionAmount !== undefined && parsed.data.deductionAmount > 0) {
      const deductionText = `[Khấu trừ cọc: ${parsed.data.deductionAmount.toLocaleString('vi-VN')}đ - Lý do: ${parsed.data.deductionReason || 'Không ghi rõ'}]`;
      finalInspectionNote = finalInspectionNote ? `${finalInspectionNote} | ${deductionText}` : deductionText;
    }

    // Đồng bộ trạng thái con máy vật lý (CameraItem)
    let targetCameraStatus: ItemStatus | undefined;
    if (nextStatus === BookingStatus.ACTIVE_RENTAL) {
      targetCameraStatus = ItemStatus.RENTED;
    } else if (
      nextStatus === BookingStatus.COMPLETED ||
      nextStatus === BookingStatus.CANCELLED ||
      nextDepositStatus === DepositStatus.REFUNDED
    ) {
      targetCameraStatus = ItemStatus.AVAILABLE;
    }

    const cameraUpdateData: any = {};
    if (targetCameraStatus) {
      cameraUpdateData.status = targetCameraStatus;
    }
    if (parsed.data.shutterCountAtReturn !== undefined) {
      cameraUpdateData.shutterCount = parsed.data.shutterCountAtReturn;
    }
    if (parsed.data.sensorInspection) {
      cameraUpdateData.sensorInspection = parsed.data.sensorInspection;
    }
    if (parsed.data.opticsCondition) {
      cameraUpdateData.opticsCondition = parsed.data.opticsCondition;
    }
    if (parsed.data.scratchNotes) {
      cameraUpdateData.scratchNotes = parsed.data.scratchNotes;
    }
    if (parsed.data.conditionGrade) {
      cameraUpdateData.conditionGrade = parsed.data.conditionGrade;
    }

    const [updatedBooking] = await prisma.$transaction([
      prisma.rentalBooking.update({
        where: { id: req.params.id },
        data: {
          status: nextStatus,
          depositStatus: nextDepositStatus,
          returnInspectionNote: finalInspectionNote || null
        },
        include: {
          user: { select: { id: true, email: true, fullName: true, phone: true, kycStatus: true } },
          cameraItem: { include: { product: true } },
          paymentAttempt: { select: { status: true, appTransId: true, reviewReason: true } }
        }
      }),
      ...(Object.keys(cameraUpdateData).length > 0
        ? [
            prisma.cameraItem.update({
              where: { id: booking.cameraItemId },
              data: cameraUpdateData
            })
          ]
        : [])
    ]);

    res.json(serializeData({
      success: true,
      message: 'Cập nhật trạng thái và đối soát cọc thành công',
      data: updatedBooking
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái đơn thuê: ' + error.message });
  }
});

// Thống kê tổng quan và chỉ số KPIs vận hành
app.get('/api/admin/stats', requireUser, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const vietnamToday = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const todayStart = new Date(`${vietnamToday}T00:00:00.000Z`);
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const [
      totalModels,
      totalUnits,
      availableUnits,
      reservedUnits,
      rentedUnits,
      maintenanceUnits,
      soldUnits,
      totalBookings,
      activeBookings,
      confirmedBookings,
      returnedPendingBookings,
      completedBookings,
      dueTodayBookings,
      overdueBookings,
      totalOrders,
      completedOrders,
      pendingKycCount,
      totalHeldDeposit,
      totalRefundedDeposit,
      totalDeductedDeposit,
      sandboxHeldDeposit
    ] = await Promise.all([
      prisma.product.count(),
      prisma.cameraItem.count(),
      prisma.cameraItem.count({ where: { status: ItemStatus.AVAILABLE } }),
      prisma.cameraItem.count({ where: { status: ItemStatus.RESERVED } }),
      prisma.cameraItem.count({ where: { status: ItemStatus.RENTED } }),
      prisma.cameraItem.count({ where: { status: ItemStatus.MAINTENANCE } }),
      prisma.cameraItem.count({ where: { status: ItemStatus.SOLD } }),
      prisma.rentalBooking.count(),
      prisma.rentalBooking.count({ where: { status: BookingStatus.ACTIVE_RENTAL } }),
      prisma.rentalBooking.count({ where: { status: BookingStatus.CONFIRMED } }),
      prisma.rentalBooking.count({ where: { status: BookingStatus.RETURNED_PENDING_INSPECTION } }),
      prisma.rentalBooking.count({ where: { status: BookingStatus.COMPLETED } }),
      prisma.rentalBooking.count({
        where: {
          status: BookingStatus.ACTIVE_RENTAL,
          endDate: { gte: todayStart, lt: tomorrowStart }
        }
      }),
      prisma.rentalBooking.count({
        where: {
          status: BookingStatus.ACTIVE_RENTAL,
          endDate: { lt: todayStart }
        }
      }),
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      prisma.user.count({ where: { kycStatus: KycStatus.PENDING } }),
      prisma.rentalBooking.aggregate({
        _sum: { depositAmount: true },
        where: { depositStatus: DepositStatus.HELD, paymentAttempt: { is: null } }
      }),
      prisma.rentalBooking.aggregate({
        _sum: { depositAmount: true },
        where: { depositStatus: DepositStatus.REFUNDED }
      }),
      prisma.rentalBooking.aggregate({
        _sum: { depositAmount: true },
        where: { depositStatus: DepositStatus.DEDUCTED }
      }),
      prisma.rentalBooking.aggregate({
        _sum: { depositAmount: true },
        where: { depositStatus: DepositStatus.HELD, paymentAttempt: { is: { status: 'PAID' } } }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalModels,
        totalUnits,
        availableUnits,
        reservedUnits,
        rentedUnits,
        maintenanceUnits,
        soldUnits,
        totalBookings,
        activeBookings,
        confirmedBookings,
        returnedPendingBookings,
        completedBookings,
        totalOrders,
        completedOrders,
        heldDepositAmount: totalHeldDeposit._sum.depositAmount || 0,
        sandboxHeldDepositAmount: sandboxHeldDeposit._sum.depositAmount || 0,
        refundedDepositAmount: totalRefundedDeposit._sum.depositAmount || 0,
        deductedDepositAmount: totalDeductedDeposit._sum.depositAmount || 0,
        utilizationRate: totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0,
        alerts: {
          dueTodayBookings,
          overdueBookings,
          pendingKycCount
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Không thể tải thống kê: ' + error.message });
  }
});

// Lấy danh sách kho máy kèm bộ lọc
app.get('/api/admin/models', requireUser, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const models = await prisma.product.findMany({
      select: { id: true, modelName: true, brand: true, slug: true },
      orderBy: [{ brand: 'asc' }, { modelName: 'asc' }], take: 200
    });
    res.json({ success: true, data: models });
  } catch {
    res.status(500).json({ success: false, message: 'Không thể tải dòng máy' });
  }
});

app.get('/api/admin/inventory', requireUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, modelId, q } = req.query;
    const where: any = {};

    if (typeof status === 'string' && Object.values(ItemStatus).includes(status as ItemStatus)) {
      where.status = status as ItemStatus;
    }

    if (typeof modelId === 'string') {
      const parsedModelId = parseInt(modelId, 10);
      if (!isNaN(parsedModelId)) {
        where.modelId = parsedModelId;
      }
    }

    if (typeof q === 'string' && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { serialNumber: { contains: term, mode: 'insensitive' } },
        { product: { modelName: { contains: term, mode: 'insensitive' } } },
        { product: { brand: { contains: term, mode: 'insensitive' } } }
      ];
    }

    const items = await prisma.cameraItem.findMany({
      where,
      include: { product: true },
      orderBy: { serialNumber: 'asc' },
      take: 200
    });
    res.json(serializeData({ success: true, data: items }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Không thể tải kho máy: ' + error.message });
  }
});

const createInventorySchema = z.object({
  serialNumber: z.string().trim().min(3).max(64),
  modelId: z.number().int().positive(),
  conditionGrade: z.string().trim().min(1).max(16).default('A (98%)'),
  shutterCount: z.number().int().min(0).max(10000000).nullable().optional(),
  depositAmount: z.number().int().min(0),
  sensorInspection: z.string().trim().max(500).nullable().optional(),
  opticsCondition: z.string().trim().min(1).max(500).default('Kính trong veo, không trầy xước, không bụi mốc'),
  scratchNotes: z.string().trim().max(500).default('Không có vết trầy xước đáng kể'),
  status: z.nativeEnum(ItemStatus).default(ItemStatus.MAINTENANCE)
});

// Thêm con máy vật lý mới vào kho
app.post('/api/admin/inventory', requireUser, requireAdmin, async (req: Request, res: Response) => {
  const parsed = createInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Dữ liệu thiết bị mới không hợp lệ'
    });
  }
  if (parsed.data.status !== ItemStatus.MAINTENANCE) {
    return res.status(400).json({ success: false, message: 'Máy mới cần được kiểm tra trước khi mở cho thuê' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.modelId }
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dòng sản phẩm' });
    }

    const existingItem = await prisma.cameraItem.findUnique({
      where: { serialNumber: parsed.data.serialNumber }
    });
    if (existingItem) {
      return res.status(409).json({ success: false, message: 'Số Serial này đã tồn tại trong kho' });
    }

    const item = await prisma.cameraItem.create({
      data: parsed.data,
      include: { product: true }
    });

    res.status(201).json(serializeData({
      success: true,
      message: 'Thêm thiết bị mới vào kho thành công',
      data: item
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi thêm thiết bị vào kho: ' + error.message });
  }
});

const updateInventorySchema = z.object({
  shutterCount: z.number().int().min(0).max(10000000).nullable().optional(),
  conditionGrade: z.string().trim().min(1).max(16).optional(),
  sensorInspection: z.string().trim().max(500).nullable().optional(),
  opticsCondition: z.string().trim().min(1).max(500).optional(),
  scratchNotes: z.string().trim().max(500).optional(),
  depositAmount: z.number().int().min(0).optional(),
  status: z.nativeEnum(ItemStatus).optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Cần ít nhất một trường thông tin để cập nhật'
});

// Cập nhật thông số Technical Passport và trạng thái thiết bị
app.patch('/api/admin/inventory/:serial', requireUser, requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Dữ liệu thiết bị không hợp lệ'
    });
  }

  if (parsed.data.status && parsed.data.status !== ItemStatus.AVAILABLE && parsed.data.status !== ItemStatus.MAINTENANCE) {
    return res.status(400).json({ success: false, message: 'Trạng thái thuê và bán phải do quy trình đơn hàng cập nhật' });
  }

  try {
    const initial = await prisma.cameraItem.findUnique({ where: { serialNumber: req.params.serial } });
    if (!initial) throw new PaymentFlowError('Không tìm thấy thiết bị', 404);
    const item = await prisma.$transaction(async tx => {
      await lockUnit(tx, initial.id);
      const current = await tx.cameraItem.findUniqueOrThrow({ where: { id: initial.id } });
      if (parsed.data.status) {
        if (current.status !== ItemStatus.AVAILABLE && current.status !== ItemStatus.MAINTENANCE) throw new PaymentFlowError('Máy đang thuộc lượt thuê; cần xử lý tại đơn thuê', 409);
        const blockedStatuses: BookingStatus[] = parsed.data.status === ItemStatus.MAINTENANCE
          ? [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.ACTIVE_RENTAL, BookingStatus.RETURNED_PENDING_INSPECTION]
          : [BookingStatus.ACTIVE_RENTAL, BookingStatus.RETURNED_PENDING_INSPECTION];
        const [activeRentals, activeOrders] = await Promise.all([
          tx.rentalBooking.count({ where: { cameraItemId: current.id, status: { in: blockedStatuses } } }),
          tx.order.count({ where: { cameraItemId: current.id, status: { in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.DELIVERING] } } })
        ]);
        if (activeRentals || activeOrders) throw new PaymentFlowError('Cần xử lý đơn đang mở trước khi thay đổi trạng thái kho', 409);
      }
      return tx.cameraItem.update({ where: { id: current.id }, data: parsed.data, include: { product: true } });
    });
    res.json(serializeData({ success: true, message: 'Cập nhật thiết bị thành công', data: item }));
  } catch (error) {
    res.status(error instanceof PaymentFlowError ? error.statusCode : 500).json({ success: false, message: error instanceof PaymentFlowError ? error.message : 'Không thể cập nhật thiết bị' });
  }
});

// Quản lý Đơn mua máy cũ kiểm định (Certified Used Sales)
app.get('/api/admin/orders', requireUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, q } = req.query;
    const where: any = {};

    if (typeof status === 'string' && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }

    if (typeof q === 'string' && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { orderCode: { contains: term, mode: 'insensitive' } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { phone: { contains: term, mode: 'insensitive' } } },
        { cameraItem: { serialNumber: { contains: term, mode: 'insensitive' } } }
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true, address: true }
        },
        cameraItem: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(serializeData({ success: true, data: orders }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách đơn mua: ' + error.message });
  }
});

const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  shippingAddress: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  warrantyMonths: z.number().int().min(1).max(36).optional()
});

// Cập nhật trạng thái đơn mua, kích hoạt bảo hành 6 tháng & chuyển máy sang SOLD
app.patch('/api/admin/orders/:id/status', requireUser, requireAdmin, requireApprovedAdminWorkflow, async (req: Request, res: Response) => {
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Dữ liệu cập nhật đơn hàng không hợp lệ'
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { cameraItem: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    const nextStatus = parsed.data.status;
    const months = parsed.data.warrantyMonths ?? order.warrantyMonths ?? 6;
    const warrantyExpiry = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);

    let targetCameraStatus: ItemStatus | undefined;
    if (nextStatus === OrderStatus.PAID || nextStatus === OrderStatus.DELIVERING || nextStatus === OrderStatus.COMPLETED) {
      targetCameraStatus = ItemStatus.SOLD;
    } else if (nextStatus === OrderStatus.CANCELLED) {
      targetCameraStatus = ItemStatus.AVAILABLE;
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: req.params.id },
        data: {
          status: nextStatus,
          shippingAddress: parsed.data.shippingAddress ?? order.shippingAddress,
          notes: parsed.data.notes ?? order.notes,
          warrantyMonths: months,
          warrantyExpiresAt: (nextStatus === OrderStatus.PAID || nextStatus === OrderStatus.DELIVERING || nextStatus === OrderStatus.COMPLETED)
            ? warrantyExpiry
            : order.warrantyExpiresAt
        },
        include: {
          user: { select: { id: true, email: true, fullName: true, phone: true } },
          cameraItem: { include: { product: true } }
        }
      }),
      ...(targetCameraStatus
        ? [
            prisma.cameraItem.update({
              where: { id: order.cameraItemId },
              data: { status: targetCameraStatus }
            })
          ]
        : [])
    ]);

    res.json(serializeData({
      success: true,
      message: 'Cập nhật trạng thái đơn mua và bảo hành thành công',
      data: updatedOrder
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật đơn mua: ' + error.message });
  }
});

// Quản lý thành viên & Danh sách hồ sơ eKYC
app.get('/api/admin/users', requireUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { role, kycStatus, q } = req.query;
    const where: any = {};

    if (typeof role === 'string' && Object.values(Role).includes(role as Role)) {
      where.role = role as Role;
    }

    if (typeof kycStatus === 'string' && Object.values(KycStatus).includes(kycStatus as KycStatus)) {
      where.kycStatus = kycStatus as KycStatus;
    }

    if (typeof q === 'string' && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        role: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            rentals: true,
            orders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Không thể tải người dùng: ' + error.message });
  }
});

const updateKycSchema = z.object({
  kycStatus: z.nativeEnum(KycStatus),
  idCardNumber: z.string().trim().max(20).optional(),
  rejectReason: z.string().trim().max(500).optional()
});

// Thẩm định hồ sơ định danh eKYC
app.patch('/api/admin/users/:id/kyc', requireUser, requireAdmin, requireApprovedAdminWorkflow, async (req: Request, res: Response) => {
  const parsed = updateKycSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Dữ liệu thẩm định eKYC không hợp lệ'
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        kycStatus: parsed.data.kycStatus,
        ...(parsed.data.idCardNumber ? { idCardNumber: parsed.data.idCardNumber } : {})
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        kycStatus: true,
        idCardNumber: true,
        updatedAt: true
      }
    });

    const statusMessage =
      parsed.data.kycStatus === KycStatus.VERIFIED
        ? 'Đã duyệt định danh eKYC thành công (giảm 50% tiền cọc khi thuê)'
        : parsed.data.kycStatus === KycStatus.REJECTED
        ? `Đã từ chối hồ sơ eKYC${parsed.data.rejectReason ? ': ' + parsed.data.rejectReason : ''}`
        : 'Đã cập nhật trạng thái hồ sơ eKYC';

    res.json({
      success: true,
      message: statusMessage,
      data: updatedUser
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái eKYC: ' + error.message });
  }
});

const updateRoleSchema = z.object({
  role: z.nativeEnum(Role)
});

// Phân quyền vai trò người dùng (CUSTOMER, ADMIN, TECHNICIAN)
app.patch('/api/admin/users/:id/role', requireUser, requireAdmin, requireApprovedAdminWorkflow, async (req: Request, res: Response) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Quyền người dùng không hợp lệ'
    });
  }

  try {
    if (res.locals.user.id === req.params.id && parsed.data.role !== Role.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Không thể hạ quyền Admin duy nhất trong hệ thống'
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: parsed.data.role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: `Đã cập nhật phân quyền thành công: ${updatedUser.role}`,
      data: updatedUser
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật phân quyền: ' + error.message });
  }
});

export { app };

// Integration tests attach their own ephemeral listener and isolated database.
if (process.env.FILMILIAR_TEST_MODE !== 'routes') app.listen(PORT, () => {

  console.log(`===============================================`);
  console.log(`🎬 Filmiliar Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📷 Camera Catalog: http://localhost:${PORT}/api/cameras`);
  console.log(`===============================================`);
});
