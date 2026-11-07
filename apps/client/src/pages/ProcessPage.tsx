/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Filmiliar locked system · editorial walkthrough · studied: yes · DNA-source: user screenshots
 * Structure: asymmetric photo + ordered timeline; one journey, no repeated policy section.
 */
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { filmiliarContact } from '../content/filmiliar';

const steps = [
  { title: 'Chọn máy & lịch thuê', copy: 'Chọn máy, ống kính và ngày nhận / trả. Xem lịch trống của chiếc bạn muốn thuê.' },
  { title: 'Thanh toán để giữ lịch', copy: 'Kiểm tra tiền thuê và cọc. Thanh toán cả bộ bằng một mã QR để xác nhận đơn.' },
  { title: 'Nhận máy, cùng kiểm tra', copy: 'Đối chiếu serial, tình trạng và phụ kiện. Xác nhận biên bản trước khi mang máy đi.' },
  { title: 'Đi chụp thôi!', copy: 'Sử dụng đúng hướng dẫn, giữ máy cẩn thận. Liên hệ Filmiliar khi cần hỗ trợ.' },
  { title: 'Trả đủ bộ, đúng hẹn', copy: 'Mang trả máy cùng toàn bộ phụ kiện theo lịch. Nhân viên tiếp nhận để nghiệm thu.' },
  { title: 'Nghiệm thu & hoàn cọc', copy: 'Nghiệm thu đủ bộ, xác nhận khấu trừ nếu có. Theo dõi tiền hoàn về giao dịch ban đầu trong tài khoản.' },
] as const;

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-film-teal';

export function ProcessPage() {
  return (
    <main className="w-full flex-1 bg-film-paper text-film-ink">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
        <header className="border-b border-film-ink/15 pb-8 sm:pb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-film-teal">Quy trình thuê máy</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h1 className="min-w-0 text-[clamp(2.5rem,5.2vw,4.75rem)] font-bold leading-[1.1] tracking-[-0.05em] [overflow-wrap:anywhere]">
              Thuê máy,<br />
              <span className="text-film-teal">gọn trong 6 bước.</span>
            </h1>
            <p className="max-w-sm text-sm leading-7 text-film-ink/75 sm:text-base lg:pb-1">
              Chọn đúng máy. Biết rõ chi phí. Theo dõi đơn đến khi hoàn cọc.
            </p>
          </div>
        </header>

        <section aria-labelledby="rental-steps" className="mt-8 grid min-w-0 items-start gap-8 sm:mt-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <h2 id="rental-steps" className="sr-only">6 bước thuê máy tại Filmiliar</h2>
          <div className="order-2 min-w-0 md:sticky md:top-24 md:order-1">
            <figure className="isolate overflow-clip rounded-3xl bg-film-teal/[0.06]">
              <div className="flex items-center justify-between px-5 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-film-teal sm:px-7 sm:pt-7">
                <span>Filmiliar</span>
              </div>
              <div className="flex aspect-[16/9] items-center justify-center px-10 py-4 md:aspect-square md:px-6 lg:px-8 lg:py-6">
                <img src="/images/products/cameras/fujifilm-x-t50/hero.jpg" alt="Máy ảnh Fujifilm X-T50 cùng ống kính" width={554} height={554} className="h-full w-full object-contain mix-blend-multiply" />
              </div>
              <figcaption className="flex items-center justify-between gap-3 px-5 pb-5 text-xs text-film-ink/75 sm:px-7 sm:pb-7">
                <span>Fujifilm X-T50</span>
                <span aria-hidden="true" className="h-px w-12 bg-film-teal/30" />
              </figcaption>
            </figure>

            <div className="mt-5 flex items-start gap-3 px-1 sm:mt-6">
              <MapPin size={19} strokeWidth={1.6} aria-hidden="true" className="mt-0.5 shrink-0 text-film-teal" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-film-teal">Điểm nhận & trả máy</p>
                <p className="mt-2 text-sm leading-6">{filmiliarContact.address}</p>
                <a href={filmiliarContact.mapsUrl} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-film-teal underline decoration-film-teal/30 underline-offset-4 hover:decoration-film-teal ${focus}`}>
                  Mở bản đồ <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <ol className="order-1 min-w-0 border-t border-film-ink/15 md:order-2 md:border-t-0">
            {steps.map((step, index) => (
              <li key={step.title} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-film-ink/15 py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5 sm:py-6 lg:first:pt-1">
                <span aria-hidden="true" className={`pt-0.5 text-[1.75rem] font-semibold leading-none tracking-[-0.05em] sm:text-[2.25rem] ${index === steps.length - 1 ? 'text-film-teal' : 'text-film-ink/65'}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-7 tracking-[-0.025em] sm:text-xl">{step.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-film-ink/75">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rental-start" className="mt-10 flex flex-col gap-5 border-t border-film-ink/15 pt-8 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pt-10">
          <h2 id="rental-start" className="max-w-sm text-2xl font-bold leading-9 tracking-[-0.035em]">Bạn đã sẵn sàng đi chụp?</h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link to="/san-pham?mode=rent" className={`inline-flex min-h-12 items-center justify-center gap-3 whitespace-nowrap rounded-xl bg-film-teal px-6 text-sm font-bold text-film-paperRaised transition-colors hover:bg-film-ink active:bg-film-ink ${focus}`}>
              Chọn thiết bị <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/thong-tin/chinh-sach" className={`inline-flex min-h-12 items-center gap-2 whitespace-nowrap text-sm font-semibold text-film-teal underline decoration-film-teal/30 underline-offset-4 hover:decoration-film-teal ${focus}`}>
              Chính sách thuê <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
