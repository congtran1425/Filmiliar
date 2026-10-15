import 'dotenv/config';
import { PrismaClient, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Đang nạp dữ liệu minh họa Filmiliar (7 Body + 4 Lens + 10 Physical Instances)...');

  // 2. Dữ liệu Cấp độ 1: 7 Body máy ảnh & 4 Lens
  const productModels = [
    {
      id: 1,
      modelName: 'Sony Alpha A7 IV',
      slug: 'sony-alpha-a7-iv',
      brand: 'Sony',
      categoryName: 'Mirrorless',
      sensorType: 'Full-Frame',
      resolutionMp: 33.0,
      videoSpecs: '4K 60p, 10-bit 4:2:2',
      hasIbis: true,
      weightGrams: 658,
      recommendedPurpose: 'Chuyên đi đu Idol / Concert, Chuyên chụp kỷ yếu',
      dailyRentalRate: 450000,
      referenceUsedPrice: BigInt(41500000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 2,
      modelName: 'Sony Alpha A7 III',
      slug: 'sony-alpha-a7-iii',
      brand: 'Sony',
      categoryName: 'Mirrorless',
      sensorType: 'Full-Frame',
      resolutionMp: 24.2,
      videoSpecs: '4K 30p, HLG/S-Log',
      hasIbis: true,
      weightGrams: 650,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông',
      dailyRentalRate: 300000,
      referenceUsedPrice: BigInt(25500000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 3,
      modelName: 'Sony ZV-E10',
      slug: 'sony-zv-e10',
      brand: 'Sony',
      categoryName: 'Compact/Vlog',
      sensorType: 'APS-C',
      resolutionMp: 24.2,
      videoSpecs: '4K 30p, Product Showcase',
      hasIbis: false,
      weightGrams: 343,
      recommendedPurpose: 'Chuyên quay TikTok / Vlog, Chuyên du lịch / dã ngoại',
      dailyRentalRate: 180000,
      referenceUsedPrice: BigInt(12000000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 4,
      modelName: 'Fujifilm X-T30 II',
      slug: 'fujifilm-x-t30-ii',
      brand: 'Fujifilm',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 26.1,
      videoSpecs: '4K 30p, Giả lập màu Film F-Log',
      hasIbis: false,
      weightGrams: 378,
      recommendedPurpose: 'Chuyên du lịch / dã ngoại, Chụp lifestyle',
      dailyRentalRate: 250000,
      referenceUsedPrice: BigInt(20000000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 5,
      modelName: 'Fujifilm X-S10',
      slug: 'fujifilm-x-s10',
      brand: 'Fujifilm',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 26.1,
      videoSpecs: '4K 30p, Có IBIS 5 trục',
      hasIbis: true,
      weightGrams: 465,
      recommendedPurpose: 'Chuyên du lịch / dã ngoại, Chuyên quay TikTok / Vlog',
      dailyRentalRate: 250000,
      referenceUsedPrice: BigInt(19500000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 6,
      modelName: 'Canon EOS R50',
      slug: 'canon-eos-r50',
      brand: 'Canon',
      categoryName: 'Mirrorless',
      sensorType: 'APS-C',
      resolutionMp: 24.2,
      videoSpecs: '4K 30p oversampled 6K',
      hasIbis: false,
      weightGrams: 375,
      recommendedPurpose: 'Chuyên du lịch / dã ngoại, Chuyên quay TikTok / Vlog',
      dailyRentalRate: 170000,
      referenceUsedPrice: BigInt(13500000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1581591524425-c7e0978865fc?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 7,
      modelName: 'Canon EOS R6',
      slug: 'canon-eos-r6',
      brand: 'Canon',
      categoryName: 'Mirrorless',
      sensorType: 'Full-Frame',
      resolutionMp: 20.1,
      videoSpecs: '4K 60p, IBIS lên đến 8 stops',
      hasIbis: true,
      weightGrams: 680,
      recommendedPurpose: 'Chuyên đi đu Idol / Concert, Chụp sự kiện',
      dailyRentalRate: 420000,
      referenceUsedPrice: BigInt(36000000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 8,
      modelName: 'Sony FE 24-70mm f/2.8 GM II',
      slug: 'sony-fe-24-70mm-f2-8-gm-ii',
      brand: 'Sony',
      categoryName: 'Lens',
      sensorType: 'Full-Frame',
      resolutionMp: null,
      videoSpecs: 'Khẩu độ f/2.8 toàn dải, ngàm E',
      hasIbis: false,
      weightGrams: 695,
      recommendedPurpose: 'Đa dụng cao cấp, Đi concert, Sự kiện',
      dailyRentalRate: 350000,
      referenceUsedPrice: BigInt(39000000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 9,
      modelName: 'Sony FE 50mm f/1.8',
      slug: 'sony-fe-50mm-f1-8',
      brand: 'Sony',
      categoryName: 'Lens',
      sensorType: 'Full-Frame',
      resolutionMp: null,
      videoSpecs: 'Khẩu độ f/1.8, fix tiêu cự, ngàm E',
      hasIbis: false,
      weightGrams: 186,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông',
      dailyRentalRate: 80000,
      referenceUsedPrice: BigInt(3200000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1622434641406-a158123450f9?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 10,
      modelName: 'Fujifilm XF 35mm f/1.4 R',
      slug: 'fujifilm-xf-35mm-f1-4-r',
      brand: 'Fujifilm',
      categoryName: 'Lens',
      sensorType: 'APS-C',
      resolutionMp: null,
      videoSpecs: 'Khẩu độ f/1.4 lớn, ngàm X',
      hasIbis: false,
      weightGrams: 187,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông, Du lịch',
      dailyRentalRate: 120000,
      referenceUsedPrice: BigInt(7500000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 11,
      modelName: 'Canon RF 50mm f/1.8 STM',
      slug: 'canon-rf-50mm-f1-8-stm',
      brand: 'Canon',
      categoryName: 'Lens',
      sensorType: 'Full-Frame',
      resolutionMp: null,
      videoSpecs: 'Khẩu độ f/1.8, STM êm mượt, ngàm RF',
      hasIbis: false,
      weightGrams: 160,
      recommendedPurpose: 'Chuyên chụp kỷ yếu / chân dung xóa phông giá rẻ',
      dailyRentalRate: 80000,
      referenceUsedPrice: BigInt(3500000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1589256469067-ea99122bbdc4?auto=format&fit=crop&w=800&q=80'
    }
  ];

  for (const model of productModels) {
    await prisma.product.upsert({
      where: { id: model.id },
      update: model,
      create: model
    });
  }

  // 3. Dữ liệu Cấp độ 2: Hồ sơ Technical Passport của 10 con máy cụ thể
  const physicalInstances = [
    // Thân máy Sony A7 IV (2 con máy khác nhau)
    {
      modelId: 1,
      serialNumber: 'S01-A7M4-8821943',
      shutterCount: 2150,
      conditionGrade: 'A+',
      sensorInspection: '0 dead pixel, không bụi bẩn, chống rung hoạt động 100%',
      opticsCondition: 'Ngàm tiếp xúc nhạy, khóa ngàm chắc chắn',
      scratchNotes: 'Máy như mới, không trầy xước thân vỏ',
      depositAmount: 3500000,
      status: ItemStatus.AVAILABLE
    },
    {
      modelId: 1,
      serialNumber: 'S01-A7M4-4410291',
      shutterCount: 14800,
      conditionGrade: 'B+',
      sensorInspection: '0 dead pixel, cảm biến sạch sau bảo dưỡng định kỳ',
      opticsCondition: 'Ngàm E hoạt động chuẩn xác',
      scratchNotes: 'Có vết xước dăm 0.5mm ở đế gắn tripod, báng cao su hơi bóng nhẹ',
      depositAmount: 3000000,
      status: ItemStatus.AVAILABLE
    },

    // Thân máy Sony A7 III
    {
      modelId: 2,
      serialNumber: 'S02-A7M3-3189201',
      shutterCount: 8500,
      conditionGrade: 'A',
      sensorInspection: '0 dead pixel, cảm biến sạch, chống rung IBIS ổn định',
      opticsCondition: 'Ngàm E nguyên bản sáng bóng, tiếp xúc nhạy',
      scratchNotes: 'Có vết xước nhẹ 1mm góc đáy máy, báng cầm chắc chắn',
      depositAmount: 2500000,
      status: ItemStatus.AVAILABLE
    },

    // Thân máy Fujifilm X-T30 II
    {
      modelId: 4,
      serialNumber: 'F02-XT30-1092834',
      shutterCount: 4600,
      conditionGrade: 'A',
      sensorInspection: 'Cảm biến sạch, không điểm chết, không xước bề mặt kính lọc',
      opticsCondition: 'Chân đồng tiếp xúc sáng bóng',
      scratchNotes: 'Trầy chấm kim 0.2mm góc cạnh gù kính ngắm, màn hình dán cường lực từ đầu',
      depositAmount: 2000000,
      status: ItemStatus.AVAILABLE
    },

    // Thân máy Fujifilm X-S10
    {
      modelId: 5,
      serialNumber: 'F05-XS10-6192841',
      shutterCount: 3200,
      conditionGrade: 'A+',
      sensorInspection: 'Cảm biến hoàn hảo, sạch bụi tuyệt đối, IBIS 5 trục êm mượt',
      opticsCondition: 'Ngàm X chuẩn xác, khóa ngàm chắc chắn',
      scratchNotes: 'Thân vỏ đẹp như mới xuất xưởng, không trầy xước',
      depositAmount: 2000000,
      status: ItemStatus.AVAILABLE
    },


    // Thân máy Sony ZV-E10
    {
      modelId: 3,
      serialNumber: 'S03-ZVE10-7734102',
      shutterCount: 1100,
      conditionGrade: 'A+',
      sensorInspection: 'Cảm biến hoàn hảo, sạch tuyệt đối',
      opticsCondition: 'Khóa ngàm hoạt động bình thường',
      scratchNotes: 'Không xước, nguyên lớp phấn vỏ sần ban đầu',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Thân máy Canon EOS R50
    {
      modelId: 6,
      serialNumber: 'C04-R50-5591204',
      shutterCount: 6200,
      conditionGrade: 'A',
      sensorInspection: '0 dead pixel, màn trập cơ hoạt động nhịp nhàng',
      opticsCondition: 'Ngàm RF chuẩn xác',
      scratchNotes: 'Vỏ đẹp, nắp che pin có 1 vết cọ nhỏ mờ 1mm',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Thân máy Canon EOS R6
    {
      modelId: 7,
      serialNumber: 'C05-R6-9921402',
      shutterCount: 17500,
      conditionGrade: 'B+',
      sensorInspection: 'Sensor sạch, chống rung IBIS cân bằng hoàn hảo',
      opticsCondition: 'Ngàm RF không cấn rãnh',
      scratchNotes: 'Bị trầy nhẹ 2mm viền đáy gần cổng kết nối Type-C',
      depositAmount: 3000000,
      status: ItemStatus.AVAILABLE
    },

    // Ống kính Sony 24-70 GM II
    {
      modelId: 8,
      serialNumber: 'L01-2470GM2-330129',
      shutterCount: null,
      conditionGrade: 'A',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Kính trong veo, không rễ tre, không nấm mốc, vòng zoom và lấy nét êm ái',
      scratchNotes: 'Hood hơi xước dăm bên ngoài, thân kính đẹp hoàn hảo',
      depositAmount: 3000000,
      status: ItemStatus.AVAILABLE
    },

    // Ống kính Fujifilm 35 f/1.4
    {
      modelId: 10,
      serialNumber: 'L02-35F14-884102',
      shutterCount: null,
      conditionGrade: 'B+',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Thấu kính trước sau không trầy, có 1-2 hạt bụi quang học li ti (không ảnh hưởng ảnh)',
      scratchNotes: 'Vòng xoay chỉnh khẩu độ có xước dăm nhẹ viền kim loại',
      depositAmount: 1500000,
      status: ItemStatus.AVAILABLE
    },

    // Ống kính Sony 50 f/1.8
    {
      modelId: 9,
      serialNumber: 'L03-50F18-120938',
      shutterCount: null,
      conditionGrade: 'A+',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Kính trong không tì vết, lấy nét AF nhanh nhạy',
      scratchNotes: 'Ngoại hình đẹp như mới xuất xưởng',
      depositAmount: 800000,
      status: ItemStatus.AVAILABLE
    },

    // Ống kính Canon RF 50 f/1.8
    {
      modelId: 11,
      serialNumber: 'L04-RF50-459102',
      shutterCount: null,
      conditionGrade: 'A',
      sensorInspection: 'Không áp dụng',
      opticsCondition: 'Kính hoàn hảo, ngàm RF sáng bóng',
      scratchNotes: 'Thân vỏ nhựa có vệt mờ rất nhẹ do cọ vào túi máy ảnh',
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

  console.log('✅ Hoàn thành khởi tạo dữ liệu mẫu Filmiliar vào Database thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
