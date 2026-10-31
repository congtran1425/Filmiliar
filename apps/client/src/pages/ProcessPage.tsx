import { Link } from 'react-router-dom';
import { useRentalPolicy } from '../lib/rental';

export function ProcessPage() {
  const { policy, error } = useRentalPolicy();
  return <main className="w-full flex-1 bg-film-paper text-film-ink"><div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-film-teal">Thuê máy tại Filmiliar</p>
    <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Chọn lịch. Nhận máy. Lưu khoảnh khắc.</h1>
    <p className="mt-5 max-w-2xl text-base leading-7 text-film-ink/70">Xem lịch của từng chiếc, biết rõ tiền thuê và cọc trước khi đặt. Theo dõi toàn bộ quá trình trong tài khoản của bạn.</p>
    <ol className="mt-10 grid gap-4 md:grid-cols-3">{[
      ['01','Chọn máy và giữ lịch','Chọn chiếc máy, ngày nhận và ngày trả. Kiểm tra tổng chi phí, đồng ý điều khoản rồi thanh toán để xác nhận lịch.'],
      ['02','Nhận máy trực tiếp','Đối chiếu serial, số shot, ngoại hình và phụ kiện. Nhân viên ghi biên bản bàn giao trước khi chuyển đơn sang đang thuê.'],
      ['03','Trả máy và hoàn cọc','Nhân viên tiếp nhận và nghiệm thu. Nếu có khấu trừ, bạn xem lý do và xác nhận trước khi hoàn phần còn lại qua ZaloPay.'],
    ].map(([n,title,copy]) => <li key={n} className="rounded-2xl border border-film-ink/10 bg-white p-6"><span className="font-mono text-sm text-film-teal">{n}</span><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-film-ink/70">{copy}</p></li>)}</ol>
    <section className="mt-10 rounded-2xl bg-film-teal/10 p-6"><h2 className="text-xl font-bold">Cọc, lịch và hủy đơn</h2>
      {error ? <p role="alert" className="mt-3 text-sm">{error}</p> : !policy ? <p role="status" className="mt-3 text-sm">Đang tải quy định...</p> : <><p className="mt-3 whitespace-pre-line text-sm leading-7">{policy.terms}</p><p className="mt-3 text-sm leading-6">Mức cọc do quản trị viên đặt riêng cho từng chiếc, không giảm theo eKYC. Hủy trước bàn giao: {policy.cancellationRefund === 'FULL_PAYMENT' ? 'hoàn toàn bộ tiền thuê và cọc' : 'hoàn cọc, không hoàn phí thuê'}.{policy.returnBufferDays > 0 && ` Lịch chừa ${policy.returnBufferDays} ngày sau ngày trả để kiểm tra máy.`}</p></>}
      <Link to="/thong-tin/dat-coc" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-film-teal underline">Chi tiết đặt cọc và hoàn tiền</Link>
    </section><Link to="/san-pham?mode=rent" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-film-teal px-6 text-sm font-bold text-white">Chọn thiết bị</Link>
  </div></main>;
}
