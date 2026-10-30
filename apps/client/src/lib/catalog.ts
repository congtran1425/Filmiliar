import { apiUrl } from './api';

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  sensorType: string;
  videoResolution: string;
  thumbnailUrl: string | null;
  rentPrice: number;
  salePrice: number;
  unitsCount: number;
}

export interface CameraUnit {
  id: number;
  serialNumber: string;
  status: 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'SOLD';
  depositAmount: number | null;
  conditionGrade: string;
  shutterCount: number | null;
  sensorInspection: string | null;
  opticsCondition: string;
  scratchNotes: string;
}

export interface ProductDetail extends ProductSummary {
  weightGram: number;
  recommendedPurpose: string;
  units: CameraUnit[];
}

export interface CatalogResponse<T> {
  data: T;
  isDemo: boolean;
}

type ApiEnvelope<T> = { success: boolean; data?: T; isDemo?: boolean; message?: string };

type ApiProduct = {
  id: number;
  slug: string;
  modelName: string;
  brand: string;
  categoryName: string;
  sensorType: string;
  videoSpecs: string | null;
  weightGrams: number;
  recommendedPurpose: string;
  dailyRentalRate: number;
  referenceUsedPrice: string | number;
  thumbnailUrl: string | null;
  units: CameraUnit[];
};

export const PRODUCT_THUMBNAILS: Record<string, string> = {
  'nikon-z30': '/images/products/cameras/nikon-z30/hero.jpeg',
  'fujifilm-x-t50': '/images/products/cameras/fujifilm-x-t50/hero.jpg',
  'sony-alpha-a6700': '/images/products/cameras/sony-alpha-a6700/hero.webp',
  'canon-eos-m50': '/images/products/cameras/canon-eos-m50/hero.png',
  'sony-zv-e10': '/images/products/cameras/sony-zv-e10/hero.webp',
  'fujifilm-x-t30-ii': '/images/products/cameras/fujifilm-x-t30-ii/hero.webp',
  'fujifilm-x-t100': '/images/products/cameras/fujifilm-x-t100/hero.webp',
  'fujifilm-x-s10': '/images/products/cameras/fujifilm-x-s10/hero.webp',
  'canon-eos-r50': '/images/products/cameras/canon-eos-r50/hero.webp',
  'canon-eos-m200': '/images/products/cameras/canon-eos-m200/hero.jpg',
  'sony-e-35mm-f1-8-oss': '/images/products/lenses/sony-e-35mm-f1-8-oss/hero.png',
  'sony-fe-50mm-f1-8': '/images/products/lenses/sony-fe-50mm-f1-8/hero.png',
  'fujifilm-xf-35mm-f1-4-r': '/images/products/lenses/fujifilm-xf-35mm-f1-4-r/hero.png',
  'canon-rf-50mm-f1-8-stm': '/images/products/lenses/canon-rf-50mm-f1-8-stm/hero.png',
};

export interface ProductImageAngle {
  label: string;
  url: string;
}

export const PRODUCT_GALLERY: Record<string, ProductImageAngle[]> = {
  'nikon-z30': [
    { label: 'Tổng thể', url: '/images/products/cameras/nikon-z30/hero.jpeg' },
    { label: 'Mặt trước', url: '/images/products/cameras/nikon-z30/front.jpg' },
    { label: 'Mặt sau', url: '/images/products/cameras/nikon-z30/back.jpg' },
    { label: 'Mặt trên', url: '/images/products/cameras/nikon-z30/top.jpg' },
  ],
  'fujifilm-x-t50': [
    { label: 'Tổng thể', url: '/images/products/cameras/fujifilm-x-t50/hero.jpg' },
    { label: 'Mặt trước', url: '/images/products/cameras/fujifilm-x-t50/front.avif' },
    { label: 'Mặt sau', url: '/images/products/cameras/fujifilm-x-t50/back.avif' },
    { label: 'Mặt trên', url: '/images/products/cameras/fujifilm-x-t50/top.avif' },
  ],
  'sony-alpha-a6700': [
    { label: 'Tổng thể', url: '/images/products/cameras/sony-alpha-a6700/hero.webp' },
    { label: 'Mặt trước', url: '/images/products/cameras/sony-alpha-a6700/front.avif' },
    { label: 'Mặt sau', url: '/images/products/cameras/sony-alpha-a6700/back.avif' },
    { label: 'Mặt trên', url: '/images/products/cameras/sony-alpha-a6700/top.avif' },
  ],
  'canon-eos-m50': [
    { label: 'Mặt trước', url: '/images/products/cameras/canon-eos-m50/hero.png' },
    { label: 'Góc nghiêng', url: '/images/products/cameras/canon-eos-m50/front.webp' },
    { label: 'Mặt sau', url: '/images/products/cameras/canon-eos-m50/back.png' },
    { label: 'Màn hình mở', url: '/images/products/cameras/canon-eos-m50/screen-open.png' },
  ],
  'sony-zv-e10': [
    { label: 'Tổng thể', url: '/images/products/cameras/sony-zv-e10/hero.webp' },
    { label: 'Mặt trước', url: '/images/products/cameras/sony-zv-e10/front.avif' },
    { label: 'Mặt sau', url: '/images/products/cameras/sony-zv-e10/back.avif' },
    { label: 'Mặt trên', url: '/images/products/cameras/sony-zv-e10/top.avif' },
  ],
  'fujifilm-x-t30-ii': [
    { label: 'Tổng thể', url: '/images/products/cameras/fujifilm-x-t30-ii/hero.webp' },
    { label: 'Màn hình nghiêng', url: '/images/products/cameras/fujifilm-x-t30-ii/back.jpg' },
    { label: 'Mặt trên', url: '/images/products/cameras/fujifilm-x-t30-ii/top.jpg' },
  ],
  'fujifilm-x-t100': [
    { label: 'Mặt trước', url: '/images/products/cameras/fujifilm-x-t100/hero.webp' },
    { label: 'Mặt sau', url: '/images/products/cameras/fujifilm-x-t100/back.webp' },
    { label: 'Màn hình nghiêng', url: '/images/products/cameras/fujifilm-x-t100/screen-open.webp' },
    { label: 'Mặt trên', url: '/images/products/cameras/fujifilm-x-t100/top.webp' },
  ],
  'fujifilm-x-s10': [
    { label: 'Tổng thể', url: '/images/products/cameras/fujifilm-x-s10/hero.webp' },
    { label: 'Mặt trước', url: '/images/products/cameras/fujifilm-x-s10/front.jpg' },
    { label: 'Mặt sau', url: '/images/products/cameras/fujifilm-x-s10/back.jpg' },
    { label: 'Mặt trên', url: '/images/products/cameras/fujifilm-x-s10/top.jpg' },
  ],
  'canon-eos-r50': [
    { label: 'Tổng thể', url: '/images/products/cameras/canon-eos-r50/hero.webp' },
    { label: 'Mặt trước', url: '/images/products/cameras/canon-eos-r50/front.avif' },
    { label: 'Mặt sau', url: '/images/products/cameras/canon-eos-r50/back.avif' },
    { label: 'Mặt trên', url: '/images/products/cameras/canon-eos-r50/top.avif' },
  ],
  'canon-eos-m200': [
    { label: 'Tổng thể', url: '/images/products/cameras/canon-eos-m200/hero.jpg' },
    { label: 'Mặt trước', url: '/images/products/cameras/canon-eos-m200/front.jpg' },
    { label: 'Mặt sau', url: '/images/products/cameras/canon-eos-m200/back.jpg' },
    { label: 'Mặt trên', url: '/images/products/cameras/canon-eos-m200/top.jpg' },
    { label: 'Màn hình selfie', url: '/images/products/cameras/canon-eos-m200/detail-1.jpg' },
    { label: 'Màn hình nghiêng', url: '/images/products/cameras/canon-eos-m200/detail-2.jpg' },
    { label: 'Flash mở', url: '/images/products/cameras/canon-eos-m200/detail-3.jpg' },
    { label: 'Cạnh bên', url: '/images/products/cameras/canon-eos-m200/detail-4.jpg' },
  ],
  'sony-e-35mm-f1-8-oss': [
    { label: 'Tổng thể', url: '/images/products/lenses/sony-e-35mm-f1-8-oss/hero.png' },
    { label: 'Thân ống kính', url: '/images/products/lenses/sony-e-35mm-f1-8-oss/detail-1.png' },
    { label: 'Nắp ống kính', url: '/images/products/lenses/sony-e-35mm-f1-8-oss/detail-2.png' },
  ],
  'sony-fe-50mm-f1-8': [
    { label: 'Tổng thể', url: '/images/products/lenses/sony-fe-50mm-f1-8/hero.png' },
    { label: 'Thấu kính', url: '/images/products/lenses/sony-fe-50mm-f1-8/detail-1.png' },
    { label: 'Gắn trên thân máy', url: '/images/products/lenses/sony-fe-50mm-f1-8/detail-2.png' },
    { label: 'Thân ống kính', url: '/images/products/lenses/sony-fe-50mm-f1-8/detail-3.png' },
  ],
  'fujifilm-xf-35mm-f1-4-r': [
    { label: 'Thân ống kính', url: '/images/products/lenses/fujifilm-xf-35mm-f1-4-r/hero.png' },
    { label: 'Mặt trước', url: '/images/products/lenses/fujifilm-xf-35mm-f1-4-r/detail-1.png' },
    { label: 'Góc nghiêng', url: '/images/products/lenses/fujifilm-xf-35mm-f1-4-r/detail-2.png' },
    { label: 'Thấu kính cận cảnh', url: '/images/products/lenses/fujifilm-xf-35mm-f1-4-r/detail-3.png' },
  ],
  'canon-rf-50mm-f1-8-stm': [
    { label: 'Tổng thể', url: '/images/products/lenses/canon-rf-50mm-f1-8-stm/hero.png' },
    { label: 'Góc nghiêng', url: '/images/products/lenses/canon-rf-50mm-f1-8-stm/detail-1.png' },
    { label: 'Vòng điều khiển', url: '/images/products/lenses/canon-rf-50mm-f1-8-stm/detail-2.png' },
    { label: 'Gắn hood', url: '/images/products/lenses/canon-rf-50mm-f1-8-stm/detail-3.png' },
    { label: 'Thân ống kính', url: '/images/products/lenses/canon-rf-50mm-f1-8-stm/detail-4.png' },
  ],
};

export const DEMO_PRODUCTS: ProductDetail[] = [
  {
    id: 'demo-nikon-z30',
    slug: 'nikon-z30',
    name: 'Nikon Z30',
    brand: 'Nikon',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 30p',
    thumbnailUrl: PRODUCT_THUMBNAILS['nikon-z30'],
    rentPrice: 200000,
    salePrice: 12500000,
    unitsCount: 2,
    weightGram: 405,
    recommendedPurpose: 'Chuyên quay TikTok / Vlog, Du lịch dã ngoại',
    units: [
      { id: -1, serialNumber: 'DEMO-Z30-01', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A+ (99%)', shutterCount: 2400, sensorInspection: '0 dead pixel, sạch tuyệt đối', opticsCondition: 'Ngàm Z sáng bóng', scratchNotes: 'Máy như mới xuất xưởng' },
      { id: -2, serialNumber: 'DEMO-Z30-02', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A (98%)', shutterCount: 6800, sensorInspection: 'Cảm biến sạch, đã bảo dưỡng', opticsCondition: 'Ngàm Z tiếp xúc chuẩn', scratchNotes: 'Vết xước dăm 0.3mm đế tripod' },
    ],
  },
  {
    id: 'demo-fujifilm-xt50',
    slug: 'fujifilm-x-t50',
    name: 'Fujifilm X-T50',
    brand: 'Fujifilm',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '6.2K 30p / 4K 60p',
    thumbnailUrl: PRODUCT_THUMBNAILS['fujifilm-x-t50'],
    rentPrice: 350000,
    salePrice: 29500000,
    unitsCount: 2,
    weightGram: 438,
    recommendedPurpose: 'Chuyên chụp kỷ yếu, Du lịch phong cảnh, Màu Film',
    units: [
      { id: -3, serialNumber: 'DEMO-XT50-01', status: 'AVAILABLE', depositAmount: 3500000, conditionGrade: 'A+ (99%)', shutterCount: 1200, sensorInspection: '0 dead pixel, 40.2MP, IBIS 7 stops', opticsCondition: 'Ngàm X chuẩn xác', scratchNotes: 'Máy siêu lướt đẹp hoàn hảo' },
    ],
  },
  {
    id: 'demo-sony-a6700',
    slug: 'sony-alpha-a6700',
    name: 'Sony Alpha A6700',
    brand: 'Sony',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 120p, 10-bit',
    thumbnailUrl: PRODUCT_THUMBNAILS['sony-alpha-a6700'],
    rentPrice: 350000,
    salePrice: 28000000,
    unitsCount: 2,
    weightGram: 493,
    recommendedPurpose: 'Chuyên đi đu Idol / Concert, Quay video chuyên nghiệp',
    units: [
      { id: -4, serialNumber: 'DEMO-A67-01', status: 'AVAILABLE', depositAmount: 3500000, conditionGrade: 'A+ (99%)', shutterCount: 3100, sensorInspection: '0 dead pixel, AI AF cực nhạy', opticsCondition: 'Ngàm E tiêu chuẩn', scratchNotes: 'Thân máy không vết trầy' },
    ],
  },
  {
    id: 'demo-canon-m50',
    slug: 'canon-eos-m50',
    name: 'Canon EOS M50',
    brand: 'Canon',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 24p / FHD 60p',
    thumbnailUrl: PRODUCT_THUMBNAILS['canon-eos-m50'],
    rentPrice: 170000,
    salePrice: 10000000,
    unitsCount: 1,
    weightGram: 390,
    recommendedPurpose: 'Chuyên quay TikTok / Vlog, Du lịch sinh viên',
    units: [
      { id: -5, serialNumber: 'DEMO-M50-01', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A (98%)', shutterCount: 4200, sensorInspection: '0 dead pixel, màn trập êm ái', opticsCondition: 'Ngàm EF-M chuẩn', scratchNotes: 'Trầy rất nhẹ viền nắp pin' },
    ],
  },
  {
    id: 'demo-sony-zve10',
    slug: 'sony-zv-e10',
    name: 'Sony ZV-E10',
    brand: 'Sony',
    category: 'Compact/Vlog',
    sensorType: 'APS-C',
    videoResolution: '4K 30p',
    thumbnailUrl: PRODUCT_THUMBNAILS['sony-zv-e10'],
    rentPrice: 170000,
    salePrice: 11000000,
    unitsCount: 1,
    weightGram: 343,
    recommendedPurpose: 'Chuyên quay TikTok / Vlog, Review sản phẩm',
    units: [
      { id: -6, serialNumber: 'DEMO-ZVE10-01', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A+ (99%)', shutterCount: 1800, sensorInspection: 'Cảm biến hoàn hảo, sạch tuyệt đối', opticsCondition: 'Ngàm E chuẩn', scratchNotes: 'Nguyên phấn sần ban đầu' },
    ],
  },
  {
    id: 'demo-fujifilm-xt30ii',
    slug: 'fujifilm-x-t30-ii',
    name: 'Fujifilm X-T30 II',
    brand: 'Fujifilm',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 30p',
    thumbnailUrl: PRODUCT_THUMBNAILS['fujifilm-x-t30-ii'],
    rentPrice: 270000,
    salePrice: 18000000,
    unitsCount: 1,
    weightGram: 378,
    recommendedPurpose: 'Du lịch và chụp đời thường màu Film',
    units: [
      { id: -7, serialNumber: 'DEMO-XT30-01', status: 'AVAILABLE', depositAmount: 2000000, conditionGrade: 'A (98%)', shutterCount: 4600, sensorInspection: 'Cảm biến sạch, không điểm chết', opticsCondition: 'Chân đồng sáng bóng', scratchNotes: 'Trầy chấm kim 0.2mm góc kính ngắm' },
    ],
  },
  {
    id: 'demo-fujifilm-xt100',
    slug: 'fujifilm-x-t100',
    name: 'Fujifilm X-T100',
    brand: 'Fujifilm',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 15p / FHD 60p',
    thumbnailUrl: PRODUCT_THUMBNAILS['fujifilm-x-t100'],
    rentPrice: 170000,
    salePrice: 8800000,
    unitsCount: 1,
    weightGram: 448,
    recommendedPurpose: 'Người mới bắt đầu, Chụp ảnh vintage',
    units: [
      { id: -8, serialNumber: 'DEMO-XT100-01', status: 'AVAILABLE', depositAmount: 1000000, conditionGrade: 'A (98%)', shutterCount: 6800, sensorInspection: 'Cảm biến sạch, hiển thị sắc nét', opticsCondition: 'Ngàm X ổn định', scratchNotes: 'Xước dăm nhẹ góc đáy' },
    ],
  },
  {
    id: 'demo-fujifilm-xs10',
    slug: 'fujifilm-x-s10',
    name: 'Fujifilm X-S10',
    brand: 'Fujifilm',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 30p, IBIS',
    thumbnailUrl: PRODUCT_THUMBNAILS['fujifilm-x-s10'],
    rentPrice: 290000,
    salePrice: 19000000,
    unitsCount: 1,
    weightGram: 465,
    recommendedPurpose: 'Du lịch dã ngoại, Quay Vlog chống rung',
    units: [
      { id: -9, serialNumber: 'DEMO-XS10-01', status: 'AVAILABLE', depositAmount: 2000000, conditionGrade: 'A+ (99%)', shutterCount: 3200, sensorInspection: 'Cảm biến hoàn hảo, IBIS 5 trục', opticsCondition: 'Ngàm X chuẩn xác', scratchNotes: 'Đẹp như mới xuất xưởng' },
    ],
  },
  {
    id: 'demo-canon-r50',
    slug: 'canon-eos-r50',
    name: 'Canon EOS R50',
    brand: 'Canon',
    category: 'Mirrorless',
    sensorType: 'APS-C',
    videoResolution: '4K 30p oversampled',
    thumbnailUrl: PRODUCT_THUMBNAILS['canon-eos-r50'],
    rentPrice: 200000,
    salePrice: 12800000,
    unitsCount: 1,
    weightGram: 375,
    recommendedPurpose: 'Du lịch sinh viên, Quay content sáng tạo',
    units: [
      { id: -10, serialNumber: 'DEMO-R50-01', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A+ (99%)', shutterCount: 2900, sensorInspection: '0 dead pixel, Dual Pixel AF II', opticsCondition: 'Ngàm RF nhạy', scratchNotes: 'Vỏ đẹp leng keng 99%' },
    ],
  },
  {
    id: 'demo-canon-m200',
    slug: 'canon-eos-m200',
    name: 'Canon EOS M200',
    brand: 'Canon',
    category: 'Compact/Vlog',
    sensorType: 'APS-C',
    videoResolution: '4K 24p',
    thumbnailUrl: PRODUCT_THUMBNAILS['canon-eos-m200'],
    rentPrice: 170000,
    salePrice: 9500000,
    unitsCount: 1,
    weightGram: 299,
    recommendedPurpose: 'Bỏ túi du lịch nhẹ nhàng, Selfie dạo phố',
    units: [
      { id: -11, serialNumber: 'DEMO-M200-01', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A+ (99%)', shutterCount: 2100, sensorInspection: 'Cảm biến sạch, lật 180 độ tốt', opticsCondition: 'Ngàm EF-M sáng bóng', scratchNotes: 'Màu trắng ngọc trai không tì vết' },
    ],
  },
  {
    id: 'demo-sony-e-35',
    slug: 'sony-e-35mm-f1-8-oss',
    name: 'Sony E 35mm f/1.8 OSS',
    brand: 'Sony',
    category: 'Lens',
    sensorType: 'APS-C',
    videoResolution: 'Khẩu lớn f/1.8, OSS',
    thumbnailUrl: PRODUCT_THUMBNAILS['sony-e-35mm-f1-8-oss'],
    rentPrice: 100000,
    salePrice: 5200000,
    unitsCount: 1,
    weightGram: 154,
    recommendedPurpose: 'Chụp chân dung xóa phông, Thiếu sáng',
    units: [
      { id: -12, serialNumber: 'DEMO-L35-01', status: 'AVAILABLE', depositAmount: 1000000, conditionGrade: 'A (98%)', shutterCount: null, sensorInspection: 'Không áp dụng', opticsCondition: 'Kính trong veo, chống rung tốt', scratchNotes: 'Thân lens đẹp, cap hood đầy đủ' },
    ],
  },
  {
    id: 'demo-sony-fe-50',
    slug: 'sony-fe-50mm-f1-8',
    name: 'Sony FE 50mm f/1.8',
    brand: 'Sony',
    category: 'Lens',
    sensorType: 'Full-Frame',
    videoResolution: 'Khẩu lớn f/1.8, ngàm FE',
    thumbnailUrl: PRODUCT_THUMBNAILS['sony-fe-50mm-f1-8'],
    rentPrice: 70000,
    salePrice: 3500000,
    unitsCount: 1,
    weightGram: 186,
    recommendedPurpose: 'Chụp chân dung kỷ yếu xóa phông sinh viên',
    units: [
      { id: -13, serialNumber: 'DEMO-L50-01', status: 'AVAILABLE', depositAmount: 800000, conditionGrade: 'A+ (99%)', shutterCount: null, sensorInspection: 'Không áp dụng', opticsCondition: 'Kính trong không tì vết', scratchNotes: 'Đẹp như mới xuất xưởng' },
    ],
  },
  {
    id: 'demo-fuji-xf-35',
    slug: 'fujifilm-xf-35mm-f1-4-r',
    name: 'Fujifilm XF 35mm f/1.4 R',
    brand: 'Fujifilm',
    category: 'Lens',
    sensorType: 'APS-C',
    videoResolution: 'Khẩu siêu lớn f/1.4',
    thumbnailUrl: PRODUCT_THUMBNAILS['fujifilm-xf-35mm-f1-4-r'],
    rentPrice: 150000,
    salePrice: 8700000,
    unitsCount: 1,
    weightGram: 187,
    recommendedPurpose: 'Huyền thoại chân dung Bokeh ma thuật',
    units: [
      { id: -14, serialNumber: 'DEMO-LF35-01', status: 'AVAILABLE', depositAmount: 1500000, conditionGrade: 'A (98%)', shutterCount: null, sensorInspection: 'Không áp dụng', opticsCondition: 'Kính trong vắt, vòng khẩu nảy êm', scratchNotes: 'Chấm kim li ti 0.1mm viền kim loại' },
    ],
  },
  {
    id: 'demo-canon-rf-50',
    slug: 'canon-rf-50mm-f1-8-stm',
    name: 'Canon RF 50mm f/1.8 STM',
    brand: 'Canon',
    category: 'Lens',
    sensorType: 'Full-Frame',
    videoResolution: 'Motor STM êm ái, ngàm RF',
    thumbnailUrl: PRODUCT_THUMBNAILS['canon-rf-50mm-f1-8-stm'],
    rentPrice: 70000,
    salePrice: 3800000,
    unitsCount: 1,
    weightGram: 160,
    recommendedPurpose: 'Chân dung xóa phông giá rẻ cho hệ máy Canon R',
    units: [
      { id: -15, serialNumber: 'DEMO-LRF50-01', status: 'AVAILABLE', depositAmount: 800000, conditionGrade: 'A+ (99%)', shutterCount: null, sensorInspection: 'Không áp dụng', opticsCondition: 'Kính hoàn hảo, ngàm RF sáng bóng', scratchNotes: 'Đẹp như mới bóc hộp' },
    ],
  },
];

export const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

export function displayThumbnail(url: string | null, slug?: string): string | null {
  const local = slug ? PRODUCT_THUMBNAILS[slug] : null;
  if (!local) return url || null;
  if (!url || /^https:\/\/(?:media\.congtc145\.id\.vn|images\.unsplash\.com)\//.test(url)) {
    return local;
  }
  return url;
}

function fromApiProduct(product: ApiProduct): ProductDetail {
  return {
    id: `prod-${product.id}`,
    slug: product.slug,
    name: product.modelName,
    brand: product.brand,
    category: product.categoryName,
    sensorType: product.sensorType,
    videoResolution: product.videoSpecs || 'Chưa có dữ liệu',
    thumbnailUrl: displayThumbnail(product.thumbnailUrl, product.slug),
    rentPrice: Number(product.dailyRentalRate),
    salePrice: Number(product.referenceUsedPrice),
    unitsCount: product.units.length,
    weightGram: product.weightGrams,
    recommendedPurpose: product.recommendedPurpose,
    units: product.units,
  };
}

async function request<T>(url: `/api/${string}`, signal?: AbortSignal): Promise<{ data: T; isDemo: boolean } | null> {
  const response = await fetch(apiUrl(url), { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API trả về mã ${response.status}`);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!envelope.success || !envelope.data) throw new Error(envelope.message || 'Dữ liệu không hợp lệ');
  return { data: envelope.data, isDemo: envelope.isDemo === true };
}

export async function getCatalog(signal?: AbortSignal): Promise<CatalogResponse<ProductSummary[]>> {
  try {
    const raw = await request<Array<Record<string, unknown>>>('/api/cameras', signal);
    if (!raw) return { data: [], isDemo: false };
    return {
      isDemo: raw.isDemo,
      data: raw.data.map((item) => {
        const itemSlug = String(item.slug);
        return {
          id: String(item.id),
          slug: itemSlug,
          name: String(item.name),
          brand: String(item.brand),
          category: String(item.category),
          sensorType: String(item.sensorType),
          videoResolution: String(item.videoResolution),
          thumbnailUrl: displayThumbnail(typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : null, itemSlug),
          rentPrice: Number(item.baseRentDailyPrice),
          salePrice: Number(item.baseSalePrice),
          unitsCount: Number(item.unitsCount || 0),
        };
      }),
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { data: DEMO_PRODUCTS, isDemo: true };
  }
}

export async function getProduct(slug: string, signal?: AbortSignal): Promise<CatalogResponse<ProductDetail | null>> {
  try {
    const raw = await request<ApiProduct>(`/api/cameras/${encodeURIComponent(slug)}`, signal);
    return { data: raw ? fromApiProduct(raw.data) : null, isDemo: raw?.isDemo || false };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { data: DEMO_PRODUCTS.find((product) => product.slug === slug) || null, isDemo: true };
  }
}
