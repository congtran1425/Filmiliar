import React, { useEffect, useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  Truck, 
  RotateCcw, 
  BookOpen, 
  MapPin, 
} from 'lucide-react';


export type InfoTabType = 'INSPECTION' | 'DEPOSIT_POLICY' | 'WARRANTY' | 'DELIVERY' | 'BLOG' | 'CONTACT';

interface InfoPagesModalProps {
  isOpen: boolean;
  initialTab?: InfoTabType;
  onClose: () => void;
}

export const InfoPagesModal: React.FC<InfoPagesModalProps> = ({ 
  isOpen, 
  initialTab = 'INSPECTION', 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<InfoTabType>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'INSPECTION', label: 'Hồ sơ thiết bị', icon: ShieldCheck },
    { id: 'DEPOSIT_POLICY', label: 'Thông tin Đặt cọc', icon: RotateCcw },
    { id: 'WARRANTY', label: 'Thông tin Bảo hành', icon: FileText },
    { id: 'DELIVERY', label: 'Giao nhận dự kiến', icon: Truck },
    { id: 'BLOG', label: 'Cẩm nang & Blog', icon: BookOpen },
    { id: 'CONTACT', label: 'Liên hệ Filmiliar', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Trung tâm Thông tin & Chính sách Filmiliar</h3>
              <p className="text-[11px] text-slate-400">Thông tin kiểm định, đặt cọc, bảo hành và hỗ trợ khách hàng</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 overflow-x-auto text-xs scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as InfoTabType)}
                className={`py-3 px-3.5 font-semibold flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap ${
                  isActive 
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto text-xs text-slate-300 space-y-6">
          {/* 1. QUY CHUẨN KIỂM ĐỊNH 24 BƯỚC */}
          {activeTab === 'INSPECTION' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider">
                  ĐỀ XUẤT CHO HỒ SƠ THIẾT BỊ
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Thông tin kiểm định cần có trên từng thiết bị</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Đây là danh sách kiểm tra trong đề án, chưa phải kết quả kiểm định của hàng đang bán hoặc cho thuê. Hồ sơ chỉ có giá trị khi gắn với đúng thiết bị, có ngày kiểm tra và dữ liệu chứng minh.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] font-mono">1</span>
                    <span>Thẩm định Cảm biến CMOS (6 bước)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-300 text-[11px] pl-6 list-disc">
                    <li>Chụp phơi sáng 30s ở ISO 6400 kiểm tra 0 Hot/Dead Pixel.</li>
                    <li>Soi bề mặt cảm biến dưới kính hiển vi chuyên dụng quang học.</li>
                    <li>Kiểm tra hệ thống rũ bụi siêu âm tự động trên bề mặt kính lọc.</li>
                    <li>Đo dải tương phản Dynamic Range và độ chuẩn màu RAW.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] font-mono">2</span>
                    <span>Đo Màn trập & Cơ khí (6 bước)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-300 text-[11px] pl-6 list-disc">
                    <li>Đọc chính xác số lần trập (Shutter count) qua chip nhớ bo mạch.</li>
                    <li>Kiểm tra tốc độ trập cơ ở các mốc 1/8000s, 1/4000s, 1/250s.</li>
                    <li>Kiểm tra độ nảy và độ nhạy của nút Shutter Button.</li>
                    <li>Kiểm tra khớp xoay lật màn hình và ron cao su báng tay cầm.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] font-mono">3</span>
                    <span>Chống rung IBIS & Autofocus (6 bước)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-300 text-[11px] pl-6 list-disc">
                    <li>Test chống rung cảm biến 5 trục ở chế độ chụp chậm 1/4s cầm tay.</li>
                    <li>Kiểm tra tính năng Real-time Eye AF bám nét mắt người và mắt động vật.</li>
                    <li>Kiểm tra nhận diện chủ thể AI (xe cộ, máy bay, chim chóc).</li>
                    <li>Đo độ trễ bắt nét trong môi trường thiếu sáng -4 EV.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] font-mono">4</span>
                    <span>Thấu kính & Thân vỏ (6 bước)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-300 text-[11px] pl-6 list-disc">
                    <li>Soi đèn laser kiểm tra thấu kính không mốc, rễ tre, không mù kính.</li>
                    <li>Đo độ mượt mà của vòng lấy nét và vòng zoom cơ học.</li>
                    <li>Kiểm tra chân đồng tiếp xúc điện tử ngàm (E-mount/X-mount/RF).</li>
                    <li>Lập bản đồ vết trầy xước có sẵn minh bạch vào Hộ chiếu KT.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 2. CHÍNH SÁCH ĐẶT CỌC & HOÀN CỌC */}
          {activeTab === 'DEPOSIT_POLICY' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  ĐANG XÂY DỰNG
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Thông tin đặt cọc và hoàn cọc</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Nhóm Filmiliar chưa chốt mức cọc, điều kiện miễn hoặc giảm cọc, thời điểm và cách hoàn cọc. Các thông tin này sẽ được công bố sau khi quy trình được thống nhất.
                </p>
              </div>
            </div>
          )}

          {/* 3. BẢO HÀNH & ĐỔI TRẢ */}
          {activeTab === 'WARRANTY' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                  ĐANG XÂY DỰNG
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Thông tin bảo hành và đổi trả</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Nhóm Filmiliar chưa chốt thời hạn bảo hành, phạm vi lỗi được hỗ trợ và điều kiện đổi trả. Trang này sẽ được cập nhật sau khi chính sách được duyệt.
                </p>
              </div>
            </div>
          )}

          {/* 4. GIAO NHẬN O2O HUB */}
          {activeTab === 'DELIVERY' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                  PHƯƠNG ÁN ĐANG XÂY DỰNG
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Phương án nhận và giao thiết bị</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-400 block font-mono">Nhận trực tiếp</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Nhóm đang xác định địa điểm, thời gian hoạt động và quy trình kiểm tra khi nhận máy. Chưa có điểm nhận được xác nhận trên website.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-blue-400 block font-mono">Giao tận nơi</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Khu vực, phí và thời gian giao nhận chưa được chốt. Giao diện xem trước chưa nhận đơn hay hứa thời gian giao cụ thể.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. CẨM NANG & BLOG */}
          {activeTab === 'BLOG' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider">
                  CẨM NANG NHIẾP ẢNH & VIDEO
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Chủ đề bài viết dự kiến</h3>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase">Đi Concert / Sân Khấu</span>
                  <h4 className="text-sm font-bold text-white">Bí kíp chọn máy ảnh & lens đi concert đu idol: Bắt trọn khoảnh khắc thần tượng</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    Nên chọn Sony A7 IV hay Canon R6? Tiêu cự 70-200mm hay 24-70mm? Hướng dẫn cách setup lấy nét bám mắt trong điều kiện ánh sáng sân khấu thay đổi liên tục.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase">Quay TikTok / Vlog</span>
                  <h4 className="text-sm font-bold text-white">Top 3 máy ảnh quay video TikTok và du lịch nhẹ dưới 400g đáng thuê nhất 2026</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    Đánh giá chi tiết Sony ZV-E10, Canon EOS R50 và Fujifilm X-T30 II: Chống rung, màu da tự nhiên và khả năng lấy nét đồ vật Product Showcase.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase">Chụp Kỷ Yếu / Chân Dung</span>
                  <h4 className="text-sm font-bold text-white">Cách chụp bộ ảnh kỷ yếu xóa phông lung linh với chi phí chỉ 80k/ngày</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    Tận dụng ống kính khẩu lớn Sony 50mm f/1.8 và Fujifilm 35mm f/1.4 để tạo hiệu ứng bokeh mịn màng, làm nổi bật chủ thể trong ngày tốt nghiệp.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 6. LIÊN HỆ & HUB */}
          {activeTab === 'CONTACT' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider">
                  KẾT NỐI VỚI CHÚNG TÔI
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Liên hệ Filmiliar</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block text-xs">Điểm trải nghiệm:</strong>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        Địa chỉ và giờ hoạt động chưa được nhóm xác nhận.
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Kênh liên hệ chính thức sẽ được công bố sau khi nhóm thống nhất vận hành.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Bạn cần tư vấn thiết bị riêng?</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Hiện website là bản trình bày dự án. Các chức năng nhận yêu cầu và tư vấn trực tiếp chưa được triển khai.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Đề án CLKDTMĐT • Nhóm 1</span>
                    <span className="font-mono text-amber-400">Filmiliar</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
