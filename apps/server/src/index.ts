import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient, ItemStatus, BookingStatus, DepositStatus, Role, KycStatus } from '@prisma/client';
import { uploadService } from './services/upload.service.js';
import { zaloPayService } from './services/zalopay.service.js';

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
  if (origin && !allowedOrigins.includes(origin)) {
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
app.use('/api/auth', rateLimit({
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

// Password hashing helper
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${digest}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]{128}$/.test(parts[2])) return false;
  const actual = crypto.scryptSync(password, parts[1], 64);
  return crypto.timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
}

// Auth helper
function getAuthUser(req: Request): any {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
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
    const numId = parseInt(String(cameraId).replace('prod-', ''));

    const product = await prisma.product.findUnique({
      where: { id: numId },
      include: { units: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Media Upload endpoint
app.post('/api/upload', (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuthUser(req) as { role?: Role } | null;
  if (process.env.ENABLE_UPLOADS !== 'true' || auth?.role !== Role.ADMIN) {
    return res.status(403).json({ success: false, message: 'Chức năng tải ảnh chưa khả dụng' });
  }
  next();
}, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file để tải lên' });
    }

    const subFolder = (req.body.subFolder as string) || 'cameras';
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

// 7.1 Tạo đơn đặt thuê & link thanh toán ZaloPay
app.post('/api/payment/create', async (req: Request, res: Response) => {
  // Chưa nhận đơn hoặc thanh toán trước khi quy tắc cọc và luồng giao dịch được duyệt.
  const checkoutEnabled = false;
  if (!checkoutEnabled) {
    return res.status(503).json({ success: false, message: 'Filmiliar chưa nhận đơn hoặc thanh toán trực tuyến.' });
  }
  try {
    const {
      cameraId,
      unitId,
      startDate,
      endDate,
      customerName,
      customerPhone,
      customerEmail,
      customerCccd,
      deliveryMethod,
      customerNotes
    } = req.body;

    const numModelId = parseInt(String(cameraId).replace('prod-', ''), 10);
    const product = await prisma.product.findUnique({
      where: { id: numModelId },
      include: { units: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị yêu cầu' });
    }

    // Chọn unit cụ thể nếu người dùng chỉ định, hoặc lấy unit khả dụng đầu tiên
    let selectedUnit = unitId
      ? product.units.find(u => u.id === Number(unitId))
      : product.units.find(u => u.status === ItemStatus.AVAILABLE);

    if (!selectedUnit && product.units.length > 0) {
      selectedUnit = product.units[0];
    }

    if (!selectedUnit) {
      return res.status(400).json({ success: false, message: 'Dòng máy này hiện chưa có con máy sẵn sàng trong kho' });
    }

    // Tính thời gian & chi phí
    const start = new Date(startDate || Date.now());
    const end = new Date(endDate || (Date.now() + 3 * 24 * 60 * 60 * 1000));
    const diffDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const totalRentalFee = diffDays * product.dailyRentalRate;
    const depositAmount = selectedUnit.depositAmount || 2000000;
    const totalInitialPayment = totalRentalFee + depositAmount;

    // Tìm hoặc tạo tài khoản User (đối với khách vãng lai)
    const email = customerEmail || (customerPhone ? `guest_${customerPhone}@filmiliar.vn` : `guest_${Date.now()}@filmiliar.vn`);
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: customerName || 'Khách hàng Filmiliar',
          phone: customerPhone || '',
          idCardNumber: customerCccd || '',
          passwordHash: hashPassword('FilmiliarGuest@2026'),
          role: Role.CUSTOMER,
          kycStatus: customerCccd ? KycStatus.PENDING : KycStatus.UNVERIFIED
        }
      });
    }

    // Tạo mã đơn đặt thuê
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `BK-${dateStr}-${randomSuffix}`;

    const booking = await prisma.rentalBooking.create({
      data: {
        bookingCode,
        userId: user.id,
        cameraItemId: selectedUnit.id,
        startDate: start,
        endDate: end,
        totalDays: diffDays,
        dailyRate: product.dailyRentalRate,
        totalRentalFee,
        depositAmount,
        depositStatus: DepositStatus.PENDING,
        status: BookingStatus.PENDING_PAYMENT,
        deliveryMethod: deliveryMethod || 'STORE_PICKUP',
        customerNotes: customerNotes || ''
      }
    });

    // Tạo đơn thanh toán sang ZaloPay Sandbox
    const zaloOrder = await zaloPayService.createPayment({
      amount: totalInitialPayment,
      description: `Filmiliar - Coc & Thue ${product.modelName.slice(0, 20)} (#${bookingCode})`,
      appUser: user.fullName,
      redirectUrl: `http://localhost:5173/?booking=${bookingCode}&status=success`,
      extraData: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        cameraSerialNumber: selectedUnit.serialNumber
      }
    });

    res.json(serializeData({
      success: true,
      data: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        cameraName: product.modelName,
        serialNumber: selectedUnit.serialNumber,
        passportCode: `TP-${selectedUnit.serialNumber}`,
        conditionGrade: selectedUnit.conditionGrade,
        totalDays: diffDays,
        dailyRate: product.dailyRentalRate,
        totalRentalFee,
        depositAmount,
        totalInitialPayment,
        zaloPay: {
          app_trans_id: zaloOrder.app_trans_id,
          order_url: zaloOrder.order_url,
          zp_trans_token: zaloOrder.zp_trans_token,
          return_code: zaloOrder.return_code,
          return_message: zaloOrder.return_message
        }
      }
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi khởi tạo thanh toán ZaloPay: ' + error.message });
  }
});

// 7.2 Kiểm tra trạng thái đơn ZaloPay (Polling từ Frontend)
app.post('/api/payment/check-status', async (req: Request, res: Response) => {
  return res.status(503).json({ success: false, message: 'Filmiliar chưa nhận thanh toán trực tuyến.' });
  try {
    const { app_trans_id, bookingCode } = req.body;
    if (!app_trans_id) {
      return res.status(400).json({ success: false, message: 'Thiếu app_trans_id' });
    }

    const queryResult = await zaloPayService.checkOrderStatus(app_trans_id);
    const isPaid = queryResult.return_code === 1;

    if (isPaid && bookingCode) {
      await prisma.rentalBooking.updateMany({
        where: { bookingCode },
        data: {
          status: BookingStatus.CONFIRMED,
          depositStatus: DepositStatus.HELD
        }
      });
    }

    res.json({
      success: true,
      isPaid,
      zaloPayData: queryResult
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7.3 Callback Webhook từ ZaloPay Server
app.post('/api/payment/callback', async (req: Request, res: Response) => {
  return res.status(503).json({ success: false, message: 'Filmiliar chưa nhận thanh toán trực tuyến.' });
  const result: any = {};
  try {
    const { data: dataStr, mac: reqMac } = req.body;
    const isValid = zaloPayService.verifyCallback(dataStr, reqMac);

    if (!isValid) {
      result.return_code = -1;
      result.return_message = 'Chữ ký MAC không hợp lệ';
    } else {
      const dataJson = JSON.parse(dataStr);
      const embedData = JSON.parse(dataJson.embed_data || '{}');

      if (embedData.bookingCode) {
        await prisma.rentalBooking.updateMany({
          where: { bookingCode: embedData.bookingCode },
          data: {
            status: BookingStatus.CONFIRMED,
            depositStatus: DepositStatus.HELD
          }
        });
      }

      result.return_code = 1;
      result.return_message = 'success';
    }
  } catch (error: any) {
    result.return_code = 0;
    result.return_message = error.message;
  }
  res.json(result);
});

// ==========================================
// 8. USER & AUTH ENDPOINTS
// ==========================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone } = req.body;
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 128 || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 120 || (phone != null && (typeof phone !== 'string' || phone.length > 30))) {
      return res.status(400).json({ success: false, message: 'Thông tin đăng ký không hợp lệ; mật khẩu cần ít nhất 10 ký tự.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã được đăng ký' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        fullName,
        phone,
        role: Role.CUSTOMER,
        kycStatus: KycStatus.UNVERIFIED
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json(serializeData({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus
      }
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128 || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json(serializeData({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus
      }
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      include: {
        rentals: {
          include: {
            cameraItem: {
              include: { product: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json(serializeData({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        idCardNumber: user.idCardNumber,
        rentals: user.rentals
      }
    }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Danh sách đơn thuê của người dùng
app.get('/api/user/rentals', async (req: Request, res: Response) => {
  try {
    const auth = getAuthUser(req);
    const bookings = await prisma.rentalBooking.findMany({
      where: auth ? { userId: auth.id } : undefined,
      include: {
        cameraItem: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json(serializeData({ success: true, data: bookings }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 9. ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Lấy tất cả đơn thuê
app.get('/api/admin/bookings', async (req: Request, res: Response) => {
  const auth = getAuthUser(req) as { role?: Role } | null;
  if (auth?.role !== Role.ADMIN) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  try {
    const bookings = await prisma.rentalBooking.findMany({
      include: {
        user: true,
        cameraItem: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(serializeData({ success: true, data: bookings }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cập nhật trạng thái đơn thuê (Duyệt, Bàn giao máy, Hoàn cọc)
app.patch('/api/admin/bookings/:id/status', async (req: Request, res: Response) => {
  const auth = getAuthUser(req) as { role?: Role } | null;
  if (auth?.role !== Role.ADMIN) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  try {
    const { status, depositStatus, returnInspectionNote } = req.body;
    const booking = await prisma.rentalBooking.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(depositStatus && { depositStatus }),
        ...(returnInspectionNote && { returnInspectionNote })
      },
      include: {
        cameraItem: true
      }
    });

    if (depositStatus === DepositStatus.REFUNDED || status === BookingStatus.COMPLETED) {
      await prisma.cameraItem.update({
        where: { id: booking.cameraItemId },
        data: { status: ItemStatus.AVAILABLE }
      });
    } else if (status === BookingStatus.ACTIVE_RENTAL) {
      await prisma.cameraItem.update({
        where: { id: booking.cameraItemId },
        data: { status: ItemStatus.RENTED }
      });
    }

    res.json(serializeData({ success: true, data: booking }));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Thống kê tổng quan cho Admin
app.get('/api/admin/stats', async (req: Request, res: Response) => {
  const auth = getAuthUser(req) as { role?: Role } | null;
  if (auth?.role !== Role.ADMIN) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  try {
    const totalModels = await prisma.product.count();
    const totalUnits = await prisma.cameraItem.count();
    const availableUnits = await prisma.cameraItem.count({ where: { status: ItemStatus.AVAILABLE } });
    const rentedUnits = await prisma.cameraItem.count({ where: { status: ItemStatus.RENTED } });
    const totalBookings = await prisma.rentalBooking.count();
    const totalHeldDeposit = await prisma.rentalBooking.aggregate({
      _sum: { depositAmount: true },
      where: { depositStatus: DepositStatus.HELD }
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
        utilizationRate: totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start Server
app.listen(PORT, () => {

  console.log(`===============================================`);
  console.log(`🎬 Filmiliar Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📷 Camera Catalog: http://localhost:${PORT}/api/cameras`);
  console.log(`===============================================`);
});
