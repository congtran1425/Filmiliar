/* Hallmark · component: camera quiz · Filmiliar locked palette
 * P5 H5 E4 S5 R5 V4 · states: default, hover, focus, active, disabled, loading, error, success
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LoaderCircle, X } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { displayThumbnail, formatVnd } from '../lib/catalog';
import { quizConfig, type QuizIntent, type QuizPurpose, type QuizRecommendation } from '../lib/cameraQuiz';

type Props = { isOpen: boolean; onClose: () => void };
const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-teal';
const primary = `inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-film-teal px-5 text-sm font-bold text-film-paperRaised hover:bg-film-ink active:bg-film-ink disabled:cursor-not-allowed disabled:bg-film-ink/20 disabled:text-film-ink/60 ${focus}`;
const secondary = `inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-film-teal hover:bg-film-teal/5 ${focus}`;

function QuizDialog({ onClose }: Pick<Props, 'onClose'>) {
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<QuizIntent | null>(null);
  const [purpose, setPurpose] = useState<QuizPurpose | null>(null);
  const [budget, setBudget] = useState<number | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizRecommendation | null>(null);
  const [error, setError] = useState('');
  const panel = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    body = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const all = [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled)',
        ) || []),
      ];
      const controls = all.filter((element) => {
        if (!(element instanceof HTMLInputElement) || element.type !== 'radio') return true;
        const group = all.filter(
          (other): other is HTMLInputElement =>
            other instanceof HTMLInputElement && other.type === 'radio' && other.name === element.name,
        );
        return element === (group.find((radio) => radio.checked) || group[0]);
      });
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      request.current?.abort();
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step, result]);

  const ready = step === 0 ? intent !== null : step === 1 ? purpose !== null : budget !== undefined;
  const question = result
    ? result.matches.length
      ? 'Gợi ý cho bạn'
      : 'Chưa có máy phù hợp'
    : ['Bạn muốn thuê hay mua?', 'Bạn dùng máy cho việc gì?', 'Ngân sách của bạn là bao nhiêu?'][step];
  const choices =
    step === 0
      ? [
          { value: 'RENT', label: 'Thuê máy' },
          { value: 'BUY', label: 'Mua máy' },
        ]
      : step === 1
        ? Object.entries(quizConfig.purposes).map(([value, item]) => ({ value, label: item.label }))
        : [
            ...(intent ? quizConfig.budgets[intent] : []).map((value) => ({
              value: String(value),
              label: `Đến ${formatVnd(value)}${intent === 'RENT' ? ' / ngày' : ''}`,
            })),
            { value: 'ANY', label: 'Chưa chốt ngân sách' },
          ];
  const selected =
    step === 0
      ? intent
      : step === 1
        ? purpose
        : budget === undefined
          ? null
          : budget === null
            ? 'ANY'
            : String(budget);
  const choose = (value: string) => {
    setError('');
    if (step === 0) {
      if (intent !== value) setBudget(undefined);
      setIntent(value as QuizIntent);
    } else if (step === 1) setPurpose(value as QuizPurpose);
    else setBudget(value === 'ANY' ? null : Number(value));
  };
  const submit = async () => {
    if (!intent || !purpose || budget === undefined || loading) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/quiz/recommend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, purpose, maxBudgetVnd: budget }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !Array.isArray(data.recommendation?.matches))
        throw new Error(data?.message || 'Chưa tải được gợi ý. Vui lòng thử lại.');
      if (!controller.signal.aborted) setResult(data.recommendation);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error && !(cause instanceof TypeError)
            ? cause.message
            : 'Không kết nối được dịch vụ gợi ý. Vui lòng thử lại.',
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const edit = (next: number) => {
    setResult(null);
    setError('');
    setStep(next);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-film-dark/65 sm:items-center sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-clip rounded-t-3xl bg-film-paper text-film-ink shadow-2xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-film-ink/15 px-5 py-4 sm:px-7">
          <h2 id={`${id}-title`} className="text-base font-bold">
            Tìm máy phù hợp
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng tư vấn chọn máy"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-film-ink/20 hover:bg-film-teal/5 ${focus}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <form
          className="flex min-h-0 flex-1 flex-col"
          aria-busy={loading}
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready || loading) return;
            if (step < 2) {
              setError('');
              setStep(step + 1);
            } else void submit();
          }}
        >
          <div ref={body} className="min-h-0 overflow-y-auto px-5 py-6 sm:px-7">
            <p className="text-xs font-bold uppercase tracking-wider text-film-teal">
              {result
                ? `${result.intent === 'RENT' ? 'Thuê máy' : 'Mua máy'} · ${result.purposeLabel}`
                : `Câu ${step + 1} / 3`}
            </p>
            <h3
              ref={heading}
              tabIndex={-1}
              className="mt-3 text-2xl font-bold leading-8 tracking-tight outline-none"
            >
              {question}
            </h3>
            {!result && (
              <>
                {step === 2 && (
                  <p className="mt-2 text-sm leading-6 text-film-ink/75">
                    {intent === 'RENT'
                      ? 'Tiền thuê tối đa mỗi ngày, chưa gồm cọc.'
                      : 'Giá mua máy tham khảo.'}
                  </p>
                )}
                <div aria-hidden="true" className="mt-5 flex gap-2">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-film-teal' : 'bg-film-ink/15'}`}
                    />
                  ))}
                </div>
                <fieldset disabled={loading} className="mt-6 space-y-3 disabled:opacity-60">
                  <legend className="sr-only">{question}</legend>
                  {choices.map((choice) => (
                    <label
                      key={choice.value}
                      className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-film-teal ${selected === choice.value ? 'border-film-teal bg-film-teal/5 text-film-teal' : 'border-film-ink/20 hover:bg-film-teal/5'} ${loading ? 'cursor-not-allowed' : ''}`}
                    >
                      <span>{choice.label}</span>
                      <input
                        type="radio"
                        name={`${id}-${step}`}
                        value={choice.value}
                        checked={selected === choice.value}
                        onChange={() => choose(choice.value)}
                        className="h-4 w-4 shrink-0 accent-film-teal"
                      />
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-700/25 p-3 text-sm leading-6 text-red-800"
              >
                {error}
              </p>
            )}
            {result && (
              <>
                {result.matches.length > 0 ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-film-ink/75">
                      {result.maxBudgetVnd === null
                        ? 'Xếp từ mức giá thấp đến cao.'
                        : `Trong mức ${formatVnd(result.maxBudgetVnd)}${result.intent === 'RENT' ? ' / ngày' : ''} bạn chọn.`}
                    </p>
                    {result.concertAdvice && (
                      <p className="mt-3 text-sm leading-6 text-film-ink">{result.concertAdvice}</p>
                    )}
                    <ul className="mt-5 divide-y divide-film-ink/15">
                      {result.matches.map((match) => (
                        <li key={match.slug} className="py-5 first:pt-0 last:pb-0">
                          <div className="flex gap-4">
                            <img
                              src={displayThumbnail(match.thumbnailUrl, match.slug) || '/filmiliar-icon.png'}
                              alt=""
                              width={80}
                              height={80}
                              className="h-20 w-20 shrink-0 rounded-xl bg-film-paperRaised object-contain p-1"
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/thiet-bi/${match.slug}?may=${match.unitId}`}
                                onClick={onClose}
                                title={match.name}
                                className={`block min-h-11 truncate pt-1.5 font-bold hover:text-film-teal ${focus}`}
                              >
                                {match.name}
                              </Link>
                              <p className="mt-2 text-xs text-film-ink/75">
                                {result.intent === 'RENT' ? 'Thuê / ngày' : 'Mua tham khảo'}
                              </p>
                              <p className="mt-1 text-base font-bold text-film-teal">
                                {formatVnd(match.priceVnd)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-end">
                            <Link
                              to={`/thiet-bi/${match.slug}/xem-lai/${result.intent === 'RENT' ? 'thue' : 'mua'}?may=${match.unitId}`}
                              onClick={onClose}
                              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-film-teal/30 px-3 text-sm font-bold text-film-teal hover:bg-film-teal/5 ${focus}`}
                            >
                              {result.intent === 'RENT' ? 'Xem lịch thuê' : 'Hẹn xem máy'}
                              <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm leading-6 text-film-ink/75">
                      {result.emptyReason === 'OVER_BUDGET' && result.minimumMatchingPrice !== null
                        ? `Máy phù hợp nhu cầu hiện bắt đầu từ ${formatVnd(result.minimumMatchingPrice)}${result.intent === 'RENT' ? ' / ngày' : ''}.`
                        : 'Chưa tìm thấy máy phù hợp trong danh mục hiện có.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => edit(result.emptyReason === 'OVER_BUDGET' ? 2 : 1)}
                      className={primary}
                    >
                      {result.emptyReason === 'OVER_BUDGET' ? 'Đổi ngân sách' : 'Đổi nhu cầu'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-film-ink/15 px-5 py-4 pb-safe sm:px-7">
            {result ? (
              <>
                <button type="button" onClick={() => edit(0)} className={secondary}>
                  Sửa lựa chọn
                </button>
                <Link
                  to={`/san-pham?mode=${result.intent === 'RENT' ? 'rent' : 'buy'}&category=camera`}
                  onClick={onClose}
                  className={secondary}
                >
                  Xem danh mục
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                {step > 0 ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setError('');
                      setStep(step - 1);
                    }}
                    className={`${secondary} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Quay lại
                  </button>
                ) : (
                  <span />
                )}
                <button type="submit" disabled={!ready || loading} className={primary}>
                  {loading ? (
                    <>
                      <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
                      Đang tìm máy
                    </>
                  ) : (
                    <>
                      {step === 2 ? (error ? 'Thử lại' : 'Xem gợi ý') : 'Tiếp tục'}
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  )}
                </button>
              </>
            )}
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

export function CameraMatchQuizModal({ isOpen, onClose }: Props) {
  return isOpen ? <QuizDialog onClose={onClose} /> : null;
}
