import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Syncing Filmiliar catalog (10 cameras and 4 lenses)...');

  // Model data only; inventory requires verified records for specific units.
  const productModels = [
    {
      modelName: 'Nikon Z30',
      slug: 'nikon-z30',
      brand: 'Nikon',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 20.9,
      videoSpecs: '4K 30p, Không giới hạn 125 phút quay liên tục',
      hasIbis: false,
      weightGrams: 405,
      recommendedPurpose: 'Chuyên quay TikTok / Vlog, Du lịch dã ngoại',
      dailyRentalRate: 200000,
      referenceUsedPrice: BigInt(12500000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/nikon-z30/hero.jpeg'
    },
    {
      modelName: 'Fujifilm X-T50',
      slug: 'fujifilm-x-t50',
      brand: 'Fujifilm',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 40.2,
      videoSpecs: '6.2K 30p, 4K 60p, F-Log2, IBIS 7 stops',
      hasIbis: true,
      weightGrams: 438,
      recommendedPurpose: 'Chuyên chụp kỷ yếu, Du lịch phong cảnh, Streetlife màu Film',
      dailyRentalRate: 350000,
      referenceUsedPrice: BigInt(29500000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/fujifilm-x-t50/hero.jpg'
    },
    {
      modelName: 'Sony Alpha A6700',
      slug: 'sony-alpha-a6700',
      brand: 'Sony',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 26.0,
      videoSpecs: '4K 120p, 10-bit 4:2:2, AI AF chủ thể, IBIS 5 trục',
      hasIbis: true,
      weightGrams: 493,
      recommendedPurpose: 'Chuyên đi đu Idol / Concert, Quay video chuyên nghiệp, Thể thao',
      dailyRentalRate: 350000,
      referenceUsedPrice: BigInt(28000000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/sony-alpha-a6700/hero.webp'
    },
    {
      modelName: 'Canon EOS M50',
      slug: 'canon-eos-m50',
      brand: 'Canon',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 24.1,
      videoSpecs: '4K 24p, Dual Pixel CMOS AF, Màn hình lật xoay đa góc',
      hasIbis: false,
      weightGrams: 390,
      recommendedPurpose: 'Chuyên quay TikTok / Vlog, Du lịch sinh viên, Chụp chân dung',
      dailyRentalRate: 170000,
      referenceUsedPrice: BigInt(10000000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/canon-eos-m50/hero.png'
    },
    {
      modelName: 'Sony ZV-E10',
      slug: 'sony-zv-e10',
      brand: 'Sony',
      categoryName: 'Compact/Vlog',
      sensorType: 'APS-C',
      resolutionMp: 24.2,
      videoSpecs: '4K 30p, Product Showcase, Làm đẹp da tự nhiên',
      hasIbis: false,
      weightGrams: 343,
      recommendedPurpose: 'Chuyên quay TikTok / Vlog, Du lịch sinh viên, Review sản phẩm',
      dailyRentalRate: 170000,
      referenceUsedPrice: BigInt(11000000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/sony-zv-e10/hero.webp'
    },
    {
      modelName: 'Fujifilm X-T30 II',
      slug: 'fujifilm-x-t30-ii',
      brand: 'Fujifilm',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 26.1,
      videoSpecs: '4K 30p, 18 bộ giả lập màu Film vintage huyền thoại',
      hasIbis: false,
      weightGrams: 378,
      recommendedPurpose: 'Chuyên du lịch / dã ngoại, Chụp lifestyle phong cách cổ điển',
      dailyRentalRate: 270000,
      referenceUsedPrice: BigInt(18000000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/fujifilm-x-t30-ii/hero.webp'
    },
    {
      modelName: 'Fujifilm X-T100',
      slug: 'fujifilm-x-t100',
      brand: 'Fujifilm',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 24.2,
      videoSpecs: '4K 15p, Full HD 60p, Màn hình lật 3 chiều độc đáo',
      hasIbis: false,
      weightGrams: 448,
      recommendedPurpose: 'Chụp ảnh hàng ngày, Phong cách hoài cổ, Dành cho người mới bắt đầu',
      dailyRentalRate: 170000,
      referenceUsedPrice: BigInt(8800000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/fujifilm-x-t100/hero.webp'
    },
    {
      modelName: 'Fujifilm X-S10',
      slug: 'fujifilm-x-s10',
      brand: 'Fujifilm',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 26.1,
      videoSpecs: '4K 30p, Chống rung IBIS 5 trục 6.0 stops, Báng tay cầm công thái học',
      hasIbis: true,
      weightGrams: 465,
      recommendedPurpose: 'Chuyên du lịch / dã ngoại, Chuyên quay TikTok / Vlog chống rung',
      dailyRentalRate: 290000,
      referenceUsedPrice: BigInt(19000000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/fujifilm-x-s10/hero.webp'
    },
    {
      modelName: 'Canon EOS R50',
      slug: 'canon-eos-r50',
      brand: 'Canon',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 24.2,
      videoSpecs: '4K 30p oversampled 6K, Dual Pixel CMOS AF II',
      hasIbis: false,
      weightGrams: 375,
      recommendedPurpose: 'Chuyên du lịch / dã ngoại, Chuyên quay TikTok / Vlog sinh viên',
      dailyRentalRate: 200000,
      referenceUsedPrice: BigInt(12800000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/canon-eos-r50/hero.webp'
    },
    {
      modelName: 'Canon EOS M200',
      slug: 'canon-eos-m200',
      brand: 'Canon',
      categoryName: 'Compact/Vlog',
      sensorType: 'APS-C',
      resolutionMp: 24.1,
      videoSpecs: '4K 24p, Màn hình cảm ứng lật 180 độ selfie',
      hasIbis: false,
      weightGrams: 299,
      recommendedPurpose: 'Chuyên du lịch gọn nhẹ bỏ túi, Chụp cafe / dạo phố, Selfie',
      dailyRentalRate: 170000,
      referenceUsedPrice: BigInt(9500000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/cameras/canon-eos-m200/hero.jpg'
    },
    {
      modelName: 'Sony E 35mm f/1.8 OSS',
      slug: 'sony-e-35mm-f1-8-oss',
      brand: 'Sony',
      categoryName: 'Lens',
      sensorType: 'APS-C',
      resolutionMp: null,
      videoSpecs: 'Khẩu lớn f/1.8, Chống rung quang học OSS, ngàm E',
      hasIbis: true,
      weightGrams: 154,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông, Thiếu sáng, Streetlife',
      dailyRentalRate: 100000,
      referenceUsedPrice: BigInt(5200000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/lenses/sony-e-35mm-f1-8-oss/hero.png'
    },
    {
      modelName: 'Sony FE 50mm f/1.8',
      slug: 'sony-fe-50mm-f1-8',
      brand: 'Sony',
      categoryName: 'Lens',
      sensorType: 'Full-Frame',
      resolutionMp: null,
      videoSpecs: 'Tiêu cự chuẩn 50mm, Khẩu lớn f/1.8, ngàm FE/E',
      hasIbis: false,
      weightGrams: 186,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông sinh viên',
      dailyRentalRate: 70000,
      referenceUsedPrice: BigInt(3500000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/lenses/sony-fe-50mm-f1-8/hero.png'
    },
    {
      modelName: 'Fujifilm XF 35mm f/1.4 R',
      slug: 'fujifilm-xf-35mm-f1-4-r',
      brand: 'Fujifilm',
      categoryName: 'Lens',
      sensorType: 'APS-C',
      resolutionMp: null,
      videoSpecs: 'Khẩu siêu lớn f/1.4, Huyền thoại xóa phông Bokeh ngàm X',
      hasIbis: false,
      weightGrams: 187,
      recommendedPurpose: 'Huyền thoại chân dung Fujifilm, Du lịch dạo phố, Bokeh ma thuật',
      dailyRentalRate: 150000,
      referenceUsedPrice: BigInt(8700000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/lenses/fujifilm-xf-35mm-f1-4-r/hero.png'
    },
    {
      modelName: 'Canon RF 50mm f/1.8 STM',
      slug: 'canon-rf-50mm-f1-8-stm',
      brand: 'Canon',
      categoryName: 'Lens',
      sensorType: 'Full-Frame',
      resolutionMp: null,
      videoSpecs: 'Motor STM êm ái, Khẩu f/1.8, ngàm Canon RF',
      hasIbis: false,
      weightGrams: 160,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông cho hệ máy Canon R',
      dailyRentalRate: 70000,
      referenceUsedPrice: BigInt(3800000),
      thumbnailUrl: 'https://filmiliar.congtc145.id.vn/images/products/lenses/canon-rf-50mm-f1-8-stm/hero.png'
    }
  ];

  const slugs = productModels.map((model) => model.slug);
  const existing = await prisma.product.findMany({ select: { slug: true, isPublished: true } });
  const currentSlugs = new Set(existing.map((item) => item.slug));
  const summary = {
    create: slugs.filter((slug) => !currentSlugs.has(slug)).length,
    update: slugs.filter((slug) => currentSlugs.has(slug)).length,
    hide: existing.filter((item) => item.isPublished && !slugs.includes(item.slug)).length
  };
  console.log('Catalog sync plan:', summary);
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Pass --apply after reviewing a database backup.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const model of productModels) {
      await tx.product.upsert({
        where: { slug: model.slug },
        update: { ...model, isPublished: true },
        create: { ...model, isPublished: true }
      });
    }
    await tx.product.updateMany({
      where: { slug: { notIn: slugs } },
      data: { isPublished: false }
    });
  });
  console.log('Catalog synced. Existing unit records and order history were preserved.');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
