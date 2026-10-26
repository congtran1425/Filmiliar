import 'dotenv/config';
import { PrismaClient, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Đang nạp dữ liệu cập nhật Filmiliar (10 Body Mirrorless + 4 Lens + 16 Physical Instances)...');

  // 1. Dữ liệu Cấp độ 1: 10 Body máy ảnh Mirrorless & 4 Lens
  const productModels = [
    {
      id: 1,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/nikon-z30/hero.jpeg'
    },
    {
      id: 2,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/fujifilm-x-t50/hero.jpg'
    },
    {
      id: 3,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/sony-alpha-a6700/hero.webp'
    },
    {
      id: 4,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/canon-eos-m50/hero.png'
    },
    {
      id: 5,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/sony-zv-e10/hero.webp'
    },
    {
      id: 6,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/fujifilm-x-t30-ii/hero.webp'
    },
    {
      id: 7,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/fujifilm-x-t100/hero.webp'
    },
    {
      id: 8,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/fujifilm-x-s10/hero.webp'
    },
    {
      id: 9,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/canon-eos-r50/hero.webp'
    },
    {
      id: 10,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/cameras/canon-eos-m200/hero.jpg'
    },
    {
      id: 11,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/lenses/sony-e-35mm-f1-8-oss/hero.png'
    },
    {
      id: 12,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/lenses/sony-fe-50mm-f1-8/hero.png'
    },
    {
      id: 13,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/lenses/fujifilm-xf-35mm-f1-4-r/hero.png'
    },
    {
      id: 14,
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
      thumbnailUrl: 'https://media.congtc145.id.vn/lenses/canon-rf-50mm-f1-8-stm/hero.png'
    }
  ];

  for (const model of productModels) {
    await prisma.product.upsert({
      where: { id: model.id },
      update: model,
      create: model
    });
  }

  // 2. Dữ liệu Cấp độ 2: Hồ sơ Technical Passport của 16 con máy cụ thể
  const physicalInstances = [
    // Nikon Z30 (2 con máy)
    {
      modelId: 1,
      serialNumber: 'N01-Z30-3189201',
      shutterCount: 2400,
      conditionGrade: 'A+',
      sensorInspection: '0 dead pixel, không bụi bẩn, cảm biến sạch hoàn hảo',
      opticsCondition: 'Ngàm Z tiếp xúc nhạy, khóa ngàm chắc chắn',
      scratchNotes: 'Máy đẹp như mới, không trầy xước thân vỏ',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },
    {
      modelId: 1,
      serialNumber: 'N01-Z30-8842109',
      shutterCount: 6800,
      conditionGrade: 'A',
      sensorInspection: '0 dead pixel, cảm biến sạch đã bảo dưỡng định kỳ',
      opticsCondition: 'Ngàm Z sáng bóng, tiếp xúc chuẩn',
      scratchNotes: 'Có vết xước dăm 0.3mm rất mờ ở đế gắn tripod',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Fujifilm X-T50 (2 con máy)
    {
      modelId: 2,
      serialNumber: 'F01-XT50-4821031',
      shutterCount: 1200,
      conditionGrade: 'A+',
      sensorInspection: '0 dead pixel, cảm biến 40.2MP sạch tuyệt đối, IBIS 7 stops hoạt động 100%',
      opticsCondition: 'Ngàm X sáng bóng, chân đồng tiếp xúc nhạy',
      scratchNotes: 'Máy siêu lướt đẹp 99%, màn hình đã dán cường lực',
      depositAmount: 3500000,
      status: ItemStatus.AVAILABLE
    },
    {
      modelId: 2,
      serialNumber: 'F01-XT50-9921402',
      shutterCount: 4500,
      conditionGrade: 'A',
      sensorInspection: '0 dead pixel, cảm biến sạch, chống rung IBIS cân bằng hoàn hảo',
      opticsCondition: 'Ngàm X nguyên bản sáng đẹp',
      scratchNotes: 'Vỏ sần nguyên lớp phấn, cấn nhẹ 0.5mm viền đáy',
      depositAmount: 3500000,
      status: ItemStatus.AVAILABLE
    },

    // Sony Alpha A6700 (2 con máy)
    {
      modelId: 3,
      serialNumber: 'S01-A67-7891204',
      shutterCount: 3100,
      conditionGrade: 'A+',
      sensorInspection: '0 dead pixel, AI AF nhận diện chủ thể siêu nhạy, cảm biến sạch',
      opticsCondition: 'Ngàm E tiêu chuẩn, chấu tiếp xúc sáng loáng',
      scratchNotes: 'Thân máy không vết trầy, báng tay cầm cao su sần nguyên bản',
      depositAmount: 3500000,
      status: ItemStatus.AVAILABLE
    },
    {
      modelId: 3,
      serialNumber: 'S01-A67-4402198',
      shutterCount: 7600,
      conditionGrade: 'A',
      sensorInspection: '0 dead pixel, cảm biến sạch sau bảo dưỡng định kỳ',
      opticsCondition: 'Ngàm E sáng bóng',
      scratchNotes: 'Có vệt xước dăm nhẹ 0.4mm dưới đáy máy, cao su hơi bóng nhẹ',
      depositAmount: 3500000,
      status: ItemStatus.AVAILABLE
    },

    // Canon EOS M50
    {
      modelId: 4,
      serialNumber: 'C01-M50-3829104',
      shutterCount: 4200,
      conditionGrade: 'A',
      sensorInspection: '0 dead pixel, màn trập cơ hoạt động êm ái nhịp nhàng',
      opticsCondition: 'Ngàm EF-M chuẩn xác, tiếp xúc tốt',
      scratchNotes: 'Ngoại hình đẹp 98%, trầy rất nhẹ viền nắp pin',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Sony ZV-E10
    {
      modelId: 5,
      serialNumber: 'S02-ZVE10-7734102',
      shutterCount: 1800,
      conditionGrade: 'A+',
      sensorInspection: 'Cảm biến hoàn hảo, sạch tuyệt đối',
      opticsCondition: 'Khóa ngàm E hoạt động chuẩn xác',
      scratchNotes: 'Không xước, nguyên lớp phấn vỏ sần ban đầu',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Fujifilm X-T30 II
    {
      modelId: 6,
      serialNumber: 'F02-XT30-1092834',
      shutterCount: 4600,
      conditionGrade: 'A',
      sensorInspection: 'Cảm biến sạch, không điểm chết, không xước bề mặt kính lọc',
      opticsCondition: 'Chân đồng tiếp xúc sáng bóng',
      scratchNotes: 'Trầy chấm kim 0.2mm góc cạnh gù kính ngắm, màn hình dán cường lực từ đầu',
      depositAmount: 2000000,
      status: ItemStatus.AVAILABLE
    },

    // Fujifilm X-T100
    {
      modelId: 7,
      serialNumber: 'F03-XT100-2901842',
      shutterCount: 6800,
      conditionGrade: 'A',
      sensorInspection: 'Cảm biến sạch, hiển thị chuẩn sắc nét, màn hình lật cơ cấu chắc chắn',
      opticsCondition: 'Ngàm X hoạt động ổn định',
      scratchNotes: 'Vỏ máy đẹp 98%, xước dăm nhẹ ở góc đáy do cọ túi xách',
      depositAmount: 1000000,
      status: ItemStatus.AVAILABLE
    },

    // Fujifilm X-S10
    {
      modelId: 8,
      serialNumber: 'F04-XS10-6192841',
      shutterCount: 3200,
      conditionGrade: 'A+',
      sensorInspection: 'Cảm biến hoàn hảo, sạch bụi tuyệt đối, IBIS 5 trục êm mượt',
      opticsCondition: 'Ngàm X chuẩn xác, khóa ngàm chắc chắn',
      scratchNotes: 'Thân vỏ đẹp như mới xuất xưởng, không trầy xước',
      depositAmount: 2000000,
      status: ItemStatus.AVAILABLE
    },

    // Canon EOS R50
    {
      modelId: 9,
      serialNumber: 'C02-R50-5591204',
      shutterCount: 2900,
      conditionGrade: 'A+',
      sensorInspection: '0 dead pixel, lấy nét Dual Pixel AF II siêu nhanh',
      opticsCondition: 'Ngàm RF tiếp xúc nhạy',
      scratchNotes: 'Vỏ đẹp leng keng 99%, nắp che pin và cổng kết nối nguyên vẹn',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Canon EOS M200
    {
      modelId: 10,
      serialNumber: 'C03-M200-8812049',
      shutterCount: 2100,
      conditionGrade: 'A+',
      sensorInspection: 'Cảm biến sạch, không điểm chết, cơ cấu lật 180 độ chắc chắn',
      opticsCondition: 'Ngàm EF-M sáng bóng',
      scratchNotes: 'Máy màu trắng ngọc trai như mới, không tì vết',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Sony E 35mm f/1.8 OSS
    {
      modelId: 11,
      serialNumber: 'L01-35F18-190283',
      shutterCount: null,
      conditionGrade: 'A',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Thấu kính trong veo, không rễ tre nấm mốc, chống rung OSS mượt mà',
      scratchNotes: 'Thân lens đẹp, cap trước sau và hood zin đầy đủ',
      depositAmount: 1000000,
      status: ItemStatus.AVAILABLE
    },

    // Sony FE 50mm f/1.8
    {
      modelId: 12,
      serialNumber: 'L02-50F18-120938',
      shutterCount: null,
      conditionGrade: 'A+',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Kính trong không tì vết, lấy nét AF nhanh nhạy',
      scratchNotes: 'Ngoại hình đẹp như mới xuất xưởng',
      depositAmount: 800000,
      status: ItemStatus.AVAILABLE
    },

    // Fujifilm XF 35mm f/1.4 R
    {
      modelId: 13,
      serialNumber: 'L03-35F14-884102',
      shutterCount: null,
      conditionGrade: 'A',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Thấu kính trước sau trong vắt, vòng khẩu độ nảy êm',
      scratchNotes: 'Vòng xoay có chấm kim li ti 0.1mm, kèm hood kim loại vuông nguyên bản',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Canon RF 50mm f/1.8 STM
    {
      modelId: 14,
      serialNumber: 'L04-RF50-459102',
      shutterCount: null,
      conditionGrade: 'A+',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Kính hoàn hảo, ngàm RF sáng bóng',
      scratchNotes: 'Đẹp như mới bóc hộp, kèm hood chống lóa',
      depositAmount: 800000,
      status: ItemStatus.AVAILABLE
    }
  ];

  for (const instance of physicalInstances) {
    await prisma.cameraItem.upsert({
      where: { serialNumber: instance.serialNumber },
      update: instance,
      create: instance
    });
  }

  console.log('✅ Hoàn thành khởi tạo dữ liệu mẫu Filmiliar mới vào Database thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
