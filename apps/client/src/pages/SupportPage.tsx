import { Link, useParams } from 'react-router-dom';

export const supportPaths = {
  INSPECTION: '/thong-tin/kiem-dinh',
  DEPOSIT_POLICY: '/thong-tin/dat-coc',
  WARRANTY: '/thong-tin/bao-hanh',
  DELIVERY: '/thong-tin/giao-nhan',
  BLOG: '/thong-tin/cam-nang',
  CONTACT: '/thong-tin/lien-he',
} as const;

const topics = [
  { slug: 'kiem-dinh', label: 'Hồ sơ thiết bị', eyebrow: 'Dữ liệu thiết bị', title: 'Hiểu đúng hồ sơ kiểm định', intro: 'Hồ sơ cần gắn với đúng chiếc máy, có ngày kiểm tra và bằng chứng cho từng nhận định. Dữ liệu hiện tại mới có các trường mô tả; chưa đủ để coi là chứng nhận độc lập.', points: ['Thông tin nên có: mã chiếc máy, số lần trập nếu áp dụng, mức ngoại hình, cảm biến, quang học và vết xước.', 'Ảnh sản phẩm trong seed chỉ là ảnh minh họa, không thể dùng để xác nhận tình trạng.', 'Khi chưa có nguồn hoặc ngày kiểm tra, trang chi tiết ghi rõ dữ liệu đang rà soát.'] },
  { slug: 'dat-coc', label: 'Đặt cọc', eyebrow: 'Đang xây dựng', title: 'Quy tắc đặt cọc chưa được chốt', intro: 'Nhóm Filmiliar chưa thống nhất mức cọc, điều kiện miễn hoặc giảm cọc, thời điểm và cách hoàn cọc. Trang xem lại chỉ tính tiền thuê tham khảo và để trống tổng thanh toán.', points: ['Chưa thu cọc hoặc tạo đơn qua website.', 'Mức cọc lưu trong dữ liệu mẫu không được dùng làm chính sách.', 'Quy tắc chính thức sẽ được công bố khi nhóm hoàn tất và duyệt nội dung.'] },
  { slug: 'bao-hanh', label: 'Bảo hành', eyebrow: 'Đang xây dựng', title: 'Bảo hành và đổi trả chưa được chốt', intro: 'Thời hạn, phạm vi lỗi được hỗ trợ và điều kiện đổi trả cho máy second-hand đang được nhóm xây dựng. Trang xem lại mua chưa hiển thị một cam kết bảo hành cố định.', points: ['Giá bán hiện là giá tham khảo của dòng máy, không phải báo giá cuối cho từng chiếc.', 'Phụ kiện đi kèm cần được xác nhận theo đúng chiếc máy.', 'Quy tắc bảo hành sẽ được đưa vào trang này sau khi được nhóm phê duyệt.'] },
  { slug: 'giao-nhan', label: 'Giao nhận', eyebrow: 'Đang xây dựng', title: 'Phương án giao nhận dự kiến', intro: 'Nhóm đang xem xét nhận trực tiếp và giao tận nơi. Chưa có địa điểm, khu vực, phí hoặc thời gian giao nhận được xác nhận.', points: ['Lựa chọn trên màn xem lại chỉ để thử hành trình UI.', 'Không có đơn hay lịch giao nhận được tạo.', 'Thông tin vận hành sẽ được công bố sau khi nhóm xác nhận.'] },
  { slug: 'cam-nang', label: 'Cẩm nang', eyebrow: 'Nội dung dự kiến', title: 'Cẩm nang chọn máy ảnh', intro: 'Nhóm dự kiến viết hướng dẫn chọn máy theo nhu cầu như du lịch, quay vlog và chụp chân dung. Bài viết chưa được biên tập và kiểm chứng nên chưa hiển thị dưới dạng bài hướng dẫn.', points: ['Bắt đầu bằng việc xác định mục đích chụp và ngân sách.', 'So sánh đúng thông số phù hợp với nhu cầu, không chỉ nhìn tên dòng máy.', 'Xem tình trạng của đúng chiếc máy trước khi quyết định thuê hoặc mua.'] },
  { slug: 'lien-he', label: 'Liên hệ', eyebrow: 'Thông tin nhóm', title: 'Kênh liên hệ Filmiliar', intro: 'Website hiện là bản phát triển cho dự án môn học. Nhóm chưa cung cấp địa chỉ, email, số điện thoại và giờ hoạt động chính thức để công bố.', points: ['Không đến địa chỉ xuất hiện trong tài liệu mẫu cũ vì địa điểm chưa được xác nhận.', 'Kênh liên hệ chính thức sẽ được cập nhật tại đây khi nhóm thống nhất.', 'Hiện website chưa nhận yêu cầu thuê, mua hoặc thanh toán.'] },
] as const;

export function SupportPage() {
  const { topic } = useParams();
  const current = topics.find((item) => item.slug === topic);
  if (!current) return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16"><h1 className="text-2xl font-bold text-white">Không tìm thấy trang thông tin</h1><Link to="/" className="mt-4 inline-block text-film-warm underline">Về trang chủ</Link></main>;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Đường dẫn" className="mb-9 text-xs text-slate-400"><Link to="/" className="hover:text-white">Trang chủ</Link> / <span className="text-slate-200">{current.label}</span></nav>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_220px]">
        <article className="rounded-2xl border border-film-border bg-film-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-film-warm">{current.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">{current.title}</h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">{current.intro}</p>
          <ul className="mt-7 space-y-4 border-t border-film-border pt-6 text-sm leading-6 text-slate-300">{current.points.map((point) => <li key={point} className="flex gap-3"><span className="text-film-warm" aria-hidden="true">•</span><span>{point}</span></li>)}</ul>
          <div className="mt-8 border-t border-film-border pt-6"><Link to="/thue" className="text-sm font-semibold text-film-warm hover:underline">Xem danh mục thiết bị →</Link></div>
        </article>
        <aside><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Thông tin khác</h2><nav aria-label="Các trang thông tin" className="space-y-1">{topics.map((item) => <Link key={item.slug} to={`/thong-tin/${item.slug}`} aria-current={item.slug === current.slug ? 'page' : undefined} className={`flex items-center min-h-[44px] rounded-lg px-3 py-2 text-sm ${item.slug === current.slug ? 'bg-film-warm/15 font-semibold text-film-warm' : 'text-slate-300 hover:bg-film-card hover:text-white'}`}>{item.label}</Link>)}</nav></aside>
      </div>
    </main>
  );
}
