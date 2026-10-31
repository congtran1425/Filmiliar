import { Link, useParams } from 'react-router-dom';
import { useRentalPolicy } from '../lib/rental';

export const supportPaths = {
  INSPECTION: '/thong-tin/kiem-dinh',
  DEPOSIT_POLICY: '/thong-tin/dat-coc',
  WARRANTY: '/thong-tin/bao-hanh',
  DELIVERY: '/thong-tin/giao-nhan',
  BLOG: '/thong-tin/cam-nang',
  CONTACT: '/thong-tin/lien-he',
} as const;

const topics = [
  { slug: 'kiem-dinh', label: 'Hồ sơ thiết bị', eyebrow: 'Từng chiếc máy', title: 'Đọc hồ sơ thiết bị', intro: 'Mỗi chiếc máy có serial, ngoại hình và lịch sử sử dụng riêng. Đối chiếu hồ sơ cùng chiếc máy khi bàn giao.', points: ['Xem số lần trập, mức ngoại hình, cảm biến, quang học và ghi chú vết xước.', 'Xác nhận phụ kiện trong bộ nhận máy, gồm pin, sạc và ống kính nếu có.', 'Biên bản ghi lại tình trạng ở cả hai thời điểm nhận và trả máy.'] },
  { slug: 'dat-coc', label: 'Đặt cọc', eyebrow: 'Quy định thuê', title: 'Đặt cọc và hoàn tiền', intro: 'Mức cọc được đặt riêng cho từng chiếc và hiển thị cùng tiền thuê trước khi thanh toán. Không áp dụng giảm cọc theo eKYC.', points: ['Sau khi trả máy, nhân viên nghiệm thu và ghi nhận tình trạng.', 'Khoản khấu trừ phải có lý do và được khách chấp thuận. Bạn có thể từ chối để yêu cầu xem xét lại.', 'Tiền hoàn được gửi về giao dịch ZaloPay ban đầu. Theo dõi trạng thái và mã hoàn trong chi tiết đơn; trạng thái đã hoàn chỉ xuất hiện khi ZaloPay xác nhận.'] },
  { slug: 'bao-hanh', label: 'Bảo hành', eyebrow: 'Hỗ trợ thiết bị', title: 'Bảo hành và hỗ trợ', intro: 'Kiểm tra phạm vi bảo hành của chiếc máy trên biên bản mua bán trước khi nhận máy.', points: ['Giữ lại mã đơn, serial và biên bản bàn giao khi cần hỗ trợ.', 'Mô tả hiện tượng lỗi và thời điểm phát hiện để được kiểm tra.', 'Phụ kiện và điều kiện hỗ trợ được xác nhận theo từng chiếc.'] },
  { slug: 'giao-nhan', label: 'Giao nhận', eyebrow: 'Nhận máy trực tiếp', title: 'Bàn giao và trả máy', intro: 'Nhận và trả máy trực tiếp theo lịch trong đơn. Chuẩn bị mã đơn và thông tin người nhận để đối chiếu.', points: ['Khi nhận: kiểm tra serial, số shot, ngoại hình và phụ kiện cùng nhân viên.', 'Trong thời gian thuê: giữ máy, pin và phụ kiện đúng bộ; liên hệ nhóm nếu cần điều chỉnh lịch.', 'Khi trả: nhân viên tiếp nhận, nghiệm thu và xử lý hoàn cọc trong hồ sơ đơn.'] },
  { slug: 'cam-nang', label: 'Cẩm nang', eyebrow: 'Chọn thiết bị', title: 'Cẩm nang chọn máy ảnh', intro: 'Bắt đầu từ nhu cầu chụp, ngân sách và bộ thiết bị bạn muốn mang theo.', points: ['Xác định mục đích như du lịch, quay vlog hoặc chụp chân dung.', 'Đối chiếu cảm biến, khả năng quay và hệ ngàm của máy với ống kính.', 'Xem tình trạng của chiếc máy và kiểm tra thao tác trước khi nhận.'] },
  { slug: 'lien-he', label: 'Liên hệ', eyebrow: 'Filmiliar', title: 'Trao đổi cùng Filmiliar', intro: 'Chuẩn bị tên thiết bị, lịch sử dụng và nhu cầu của bạn khi trao đổi cùng nhóm.', points: ['Với đơn thuê đang có, dùng mã đơn trong tài khoản để tra cứu.', 'Với hẹn xem máy, ghi lại dòng máy và serial bạn quan tâm.', 'Thống nhất địa điểm và thời gian nhận máy cùng nhóm trước khi đến.'] },
] as const;

export function SupportPage({ topicOverride }: { topicOverride?: string } = {}) {
  const { topic } = useParams();
  const { policy, error } = useRentalPolicy();
  const current = topics.find((item) => item.slug === (topicOverride || topic));
  if (!current) return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16"><h1 className="text-2xl font-bold text-white">Không tìm thấy trang thông tin</h1><Link to="/" className="mt-4 inline-block text-film-warm underline">Về trang chủ</Link></main>;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Đường dẫn" className="mb-9 text-xs text-slate-400"><Link to="/" className="hover:text-white">Trang chủ</Link> / <span className="text-slate-200">{current.label}</span></nav>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_220px]">
        <article className="rounded-2xl border border-film-border bg-film-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-film-warm">{current.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">{current.title}</h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">{current.intro}</p>
          {current.slug === 'dat-coc' && <div className="mt-5 rounded-xl border border-film-border bg-film-dark p-4 text-sm leading-7 text-slate-300">{error ? <p role="alert">{error}</p> : policy ? <><p className="whitespace-pre-line">{policy.terms}</p><p className="mt-3">Hủy trước bàn giao: {policy.cancellationRefund === 'FULL_PAYMENT' ? 'hoàn cả phí thuê và cọc' : 'hoàn cọc, không hoàn phí thuê'}.</p><p className="mt-2 text-xs text-slate-400">Phiên bản {policy.version}. Đơn đã đặt giữ nguyên điều khoản tại thời điểm đặt.</p></> : <p role="status">Đang tải quy định...</p>}</div>}
          <ul className="mt-7 space-y-4 border-t border-film-border pt-6 text-sm leading-6 text-slate-300">{current.points.map((point) => <li key={point} className="flex gap-3"><span className="text-film-warm" aria-hidden="true">•</span><span>{point}</span></li>)}</ul>
          <div className="mt-8 border-t border-film-border pt-6"><Link to="/san-pham" className="text-sm font-semibold text-film-warm hover:underline">Xem danh mục thiết bị →</Link></div>
        </article>
        <aside><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Thông tin khác</h2><nav aria-label="Các trang thông tin" className="space-y-1">{topics.map((item) => <Link key={item.slug} to={`/thong-tin/${item.slug}`} aria-current={item.slug === current.slug ? 'page' : undefined} className={`flex items-center min-h-[44px] rounded-lg px-3 py-2 text-sm ${item.slug === current.slug ? 'bg-film-warm/15 font-semibold text-film-warm' : 'text-slate-300 hover:bg-film-card hover:text-white'}`}>{item.label}</Link>)}</nav></aside>
      </div>
    </main>
  );
}
