/* Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V4 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/session';

type Tab = 'tong-quan' | 'don-thue' | 'kho-may' | 'nguoi-dung';
type Stats = { totalModels: number; totalUnits: number; availableUnits: number; rentedUnits: number; totalBookings: number; heldDepositAmount: number; sandboxHeldDepositAmount: number; utilizationRate: number };
type InventoryItem = {
  id: number; serialNumber: string; shutterCount: number | null; conditionGrade: string;
  sensorInspection: string | null; opticsCondition: string; scratchNotes: string;
  status: 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'SOLD';
  product: { modelName: string; brand: string; slug: string };
};
type Booking = {
  id: string; bookingCode: string; status: string; depositStatus: string;
  user: { fullName: string; email: string; kycStatus: string };
  cameraItem: { serialNumber: string; product: { modelName: string } };
  paymentAttempt: { status: string; appTransId: string; reviewReason: string | null } | null;
};
type ListedUser = { id: string; email: string; fullName: string; phone: string | null; role: string; kycStatus: string; createdAt: string };
const tabs: { id: Tab; label: string }[] = [
  { id: 'tong-quan', label: 'Tổng quan' },
  { id: 'don-thue', label: 'Đơn thuê' },
  { id: 'kho-may', label: 'Kho máy' },
  { id: 'nguoi-dung', label: 'Người dùng' }
];
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' đ';

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = tabs.some((item) => item.id === requested) ? requested as Tab : 'tong-quan';
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [users, setUsers] = useState<ListedUser[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSerial, setSelectedSerial] = useState('');
  const [form, setForm] = useState({ shutterCount: '', conditionGrade: '', sensorInspection: '', opticsCondition: '', scratchNotes: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    const endpoint = {
      'tong-quan': '/api/admin/stats',
      'don-thue': '/api/admin/bookings',
      'kho-may': '/api/admin/inventory',
      'nguoi-dung': '/api/admin/users'
    }[tab] as `/api/${string}`;
    apiRequest<{ stats?: Stats; data?: Booking[] | InventoryItem[] | ListedUser[] }>(endpoint, { signal: controller.signal })
      .then((result) => {
        if (tab === 'tong-quan') setStats(result.stats || null);
        if (tab === 'don-thue') setBookings(result.data as Booking[]);
        if (tab === 'kho-may') setInventory(result.data as InventoryItem[]);
        if (tab === 'nguoi-dung') setUsers(result.data as ListedUser[]);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu'); });
    return () => controller.abort();
  }, [tab]);

  const selectItem = (item: InventoryItem) => {
    setSelectedSerial(item.serialNumber);
    setMessage('');
    setForm({
      shutterCount: item.shutterCount == null ? '' : String(item.shutterCount),
      conditionGrade: item.conditionGrade,
      sensorInspection: item.sensorInspection || '',
      opticsCondition: item.opticsCondition,
      scratchNotes: item.scratchNotes
    });
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSerial) return;
    setBusy(true); setMessage('');
    try {
      const result = await apiRequest<{ data: InventoryItem }>(`/api/admin/inventory/${encodeURIComponent(selectedSerial)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          shutterCount: form.shutterCount === '' ? null : Number(form.shutterCount),
          conditionGrade: form.conditionGrade,
          sensorInspection: form.sensorInspection || null,
          opticsCondition: form.opticsCondition,
          scratchNotes: form.scratchNotes
        })
      });
      setInventory((items) => items?.map((item) => item.id === result.data.id ? result.data : item) || null);
      setMessage('Đã lưu bản ghi thiết bị. Thông tin kiểm định cần bằng chứng trước khi công bố như Passport xác minh.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không thể lưu thiết bị'); }
    finally { setBusy(false); }
  };

  const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-film-warm">Quản trị Filmiliar</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Trung tâm vận hành</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Danh mục hiện là dữ liệu minh họa. Chưa có quy trình nhận đơn, giữ cọc, hoàn cọc hoặc duyệt giấy tờ định danh; các chỉ số không dùng để đối soát tài chính.</p>
      <nav aria-label="Mục quản trị" className="mt-7 flex gap-2 overflow-x-auto border-b border-film-border pb-3">
        {tabs.map((item) => <button key={item.id} onClick={() => { setMessage(''); setParams({ tab: item.id }); }} aria-current={tab === item.id ? 'page' : undefined}
          className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold ${tab === item.id ? 'bg-film-warm text-film-dark' : 'bg-film-card text-slate-200 hover:text-white'}`}>{item.label}</button>)}
      </nav>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-lg border border-film-border bg-film-card p-3 text-sm text-slate-200">{message}</p>}

      {tab === 'tong-quan' && (stats ? <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Chỉ số từ bản ghi hiện có</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Dòng máy', stats.totalModels],
            ['Chiếc máy', stats.totalUnits],
            ['Ghi là sẵn sàng', stats.availableUnits],
            ['Ghi là đang thuê', stats.rentedUnits],
            ['Đơn thuê lưu trong DB', stats.totalBookings],
            ['Tỷ lệ ghi nhận đang thuê', stats.utilizationRate + '%']
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-film-border bg-film-card p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value}</p></div>)}
        </div>
        <p className="mt-5 text-sm text-slate-400">Cọc HELD từ bản ghi cũ: {money(stats.heldDepositAmount)}; từ lượt thử Sandbox: {money(stats.sandboxHeldDepositAmount)}. Cả hai con số không chứng minh đã thu tiền thật.</p>
      </section> : !error && <p role="status" className="mt-7 text-slate-400">Đang tải thống kê...</p>)}

      {tab === 'don-thue' && <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Đơn thuê trong hệ thống</h2>
        <p className="mt-2 text-sm text-slate-400">Tạm chỉ xem. Các thao tác xác nhận, bàn giao và hoàn cọc đã khóa tại API.</p>
        {!bookings && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : bookings?.length === 0 ? <p className="mt-5 rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Chưa có đơn thuê.</p> : <div className="mt-5 space-y-3">{bookings?.map((booking) =>
          <article key={booking.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-semibold text-white">{booking.bookingCode} · {booking.cameraItem.product.modelName}</h3>
            <p className="mt-1 text-sm text-slate-300">{booking.user.fullName} · {booking.user.email} · chiếc {booking.cameraItem.serialNumber}</p>
            <p className="mt-2 text-sm text-slate-400">Đơn: {booking.status} · cọc trong dữ liệu: {booking.depositStatus}</p>
            {booking.paymentAttempt && <p className="mt-1 text-sm text-amber-300">ZaloPay Sandbox · {booking.paymentAttempt.status} · GD {booking.paymentAttempt.appTransId}</p>}
            {booking.paymentAttempt?.reviewReason && <p className="mt-1 text-sm text-red-300">Cần đối soát: {booking.paymentAttempt.reviewReason}</p>}
          </article>)}</div>}
      </section>}

      {tab === 'kho-may' && <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Kho máy và dữ liệu tình trạng</h2>
        <p className="mt-2 text-sm text-slate-400">Sửa bản ghi theo đúng serial. Chưa có ngày kiểm tra hoặc ảnh bằng chứng nên chưa gọi đây là Passport đã xác minh.</p>
        {!inventory && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <div className="space-y-2">{inventory?.map((item) =>
            <button key={item.id} type="button" onClick={() => selectItem(item)} aria-pressed={selectedSerial === item.serialNumber}
              className={`min-h-14 w-full rounded-xl border p-4 text-left ${selectedSerial === item.serialNumber ? 'border-film-warm bg-film-warm/10' : 'border-film-border bg-film-card hover:border-film-warm/50'}`}>
              <span className="block font-semibold text-white">{item.product.modelName}</span>
              <span className="mt-1 block text-sm text-slate-400">{item.serialNumber} · {item.status} · {item.conditionGrade}</span>
            </button>)}</div>
          {selectedSerial ? <form onSubmit={saveItem} className="h-fit space-y-3 rounded-xl border border-film-border bg-film-card p-5 lg:sticky lg:top-24">
            <h3 className="text-lg font-bold text-white">Sửa chiếc {selectedSerial}</h3>
            <label className="block text-sm text-slate-200">Số lần trập<input className={inputClass} type="number" min={0} max={10000000} value={form.shutterCount} onChange={(event) => setForm({ ...form, shutterCount: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Mức ngoại hình<input className={inputClass} required maxLength={16} value={form.conditionGrade} onChange={(event) => setForm({ ...form, conditionGrade: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Cảm biến<input className={inputClass} maxLength={500} value={form.sensorInspection} onChange={(event) => setForm({ ...form, sensorInspection: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Ống kính / ngàm<input className={inputClass} required maxLength={500} value={form.opticsCondition} onChange={(event) => setForm({ ...form, opticsCondition: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Ghi chú ngoại hình<input className={inputClass} maxLength={500} value={form.scratchNotes} onChange={(event) => setForm({ ...form, scratchNotes: event.target.value })} /></label>
            <p className="text-sm text-slate-400">Trạng thái kho: {inventory?.find((item) => item.serialNumber === selectedSerial)?.status}. Việc đổi trạng thái thuê hoặc bán sẽ mở khi có quy trình xác nhận giao dịch.</p>
            <button disabled={busy} className="min-h-11 rounded-lg bg-film-warm px-5 text-sm font-bold text-film-dark disabled:opacity-50">Lưu bản ghi</button>
          </form> : <p className="text-sm text-slate-400">Chọn một chiếc máy để xem và sửa dữ liệu.</p>}
        </div>}
      </section>}

      {tab === 'nguoi-dung' && <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Người dùng</h2>
        <p className="mt-2 text-sm text-slate-400">Chỉ hiển thị hồ sơ cơ bản và trạng thái định danh. Chưa mở xem giấy tờ hoặc duyệt eKYC.</p>
        {!users && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : users?.length === 0 ? <p className="mt-5 rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Chưa có tài khoản.</p> : <div className="mt-5 space-y-3">{users?.map((user) =>
          <article key={user.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-semibold text-white">{user.fullName}</h3>
            <p className="mt-1 text-sm text-slate-300">{user.email} · {user.role}</p>
            <p className="mt-2 text-sm text-slate-400">Định danh: {user.kycStatus}</p>
          </article>)}</div>}
      </section>}
    </main>
  );
}
