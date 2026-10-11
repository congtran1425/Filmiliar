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
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'SOLD';
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

const DEMO_PRODUCTS: ProductDetail[] = [
  {
    id: 'demo-sony-a7-iv', slug: 'sony-alpha-a7-iv', name: 'Sony Alpha A7 IV', brand: 'Sony',
    category: 'Mirrorless', sensorType: 'Full-Frame', videoResolution: '4K 60p',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80',
    rentPrice: 450000, salePrice: 41500000, unitsCount: 1, weightGram: 658,
    recommendedPurpose: 'Chụp chân dung và quay video',
    units: [{ id: -1, serialNumber: 'DEMO-A7IV-01', status: 'AVAILABLE', conditionGrade: 'Chưa xác minh', shutterCount: null, sensorInspection: null, opticsCondition: 'Chưa có dữ liệu', scratchNotes: 'Chưa có dữ liệu' }],
  },
  {
    id: 'demo-fujifilm-xt30ii', slug: 'fujifilm-x-t30-ii', name: 'Fujifilm X-T30 II', brand: 'Fujifilm',
    category: 'Mirrorless', sensorType: 'APS-C', videoResolution: '4K 30p',
    thumbnailUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1000&q=80',
    rentPrice: 250000, salePrice: 20000000, unitsCount: 1, weightGram: 378,
    recommendedPurpose: 'Du lịch và chụp đời thường',
    units: [{ id: -2, serialNumber: 'DEMO-XT30-01', status: 'AVAILABLE', conditionGrade: 'Chưa xác minh', shutterCount: null, sensorInspection: null, opticsCondition: 'Chưa có dữ liệu', scratchNotes: 'Chưa có dữ liệu' }],
  },
];

export const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

// Các URL trong seed hiện trỏ tới chân dung, đồng hồ, máy chụp ảnh lấy liền
// hoặc vật khác. Không dùng chúng làm ảnh cho máy và ống kính tương ứng.
const unrelatedSeedImages = [
  'photo-1500648767791-00dcc994a43e',
  'photo-1507679799987-c73779587ccf',
  'photo-1622434641406-a158123450f9',
  'photo-1526170375885-4d8ecf77b99f',
  'photo-1589256469067-ea99122bbdc4',
];

function displayThumbnail(url: string | null): string | null {
  if (!url || unrelatedSeedImages.some((id) => url.includes(id))) return null;
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
    thumbnailUrl: displayThumbnail(product.thumbnailUrl),
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
      data: raw.data.map((item) => ({
        id: String(item.id), slug: String(item.slug), name: String(item.name),
        brand: String(item.brand), category: String(item.category),
        sensorType: String(item.sensorType), videoResolution: String(item.videoResolution),
        thumbnailUrl: displayThumbnail(typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : null),
        rentPrice: Number(item.baseRentDailyPrice), salePrice: Number(item.baseSalePrice),
        unitsCount: Number(item.unitsCount || 0),
      })),
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
