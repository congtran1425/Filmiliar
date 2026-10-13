/* Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V4 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Camera, ClipboardList, Package, Search, ShieldCheck, Users } from 'lucide-react';
import { apiRequest } from '../lib/session';

type Tab = 'tong-quan' | 'don-thue' | 'kho-may' | 'don-mua' | 'nguoi-dung';
type Stats = {
  totalModels: number; totalUnits: number; availableUnits: number; reservedUnits: number; rentedUnits: number;
  maintenanceUnits: number; soldUnits: number; totalBookings: number; totalOrders: number;
  heldDepositAmount: number; sandboxHeldDepositAmount: number; utilizationRate: number;
  alerts: { dueTodayBookings: number; overdueBookings: number; pendingKycCount: number };
};
type InventoryItem = {
  id: number; modelId: number; serialNumber: string; shutterCount: number | null; conditionGrade: string;
  sensorInspection: string | null; opticsCondition: string; scratchNotes: string;
  status: 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'SOLD';
  product: { id: number; modelName: string; brand: string; slug: string };
};
type Booking = {
  id: string; bookingCode: string; status: string; depositStatus: string; startDate: string; endDate: string;
  user: { fullName: string; email: string; phone?: string | null; kycStatus: string };
  cameraItem: { serialNumber: string; product: { modelName: string } };
  paymentAttempt: { status: string; appTransId: string; reviewReason: string | null } | null;
};
type Order = { id: string; orderCode: string; status: string; totalAmount: number; createdAt: string; warrantyMonths: number | null; warrantyExpiresAt: string | null;
  user: { fullName: string; email: string }; cameraItem: { serialNumber: string; product: { modelName: string } } };
type ListedUser = { id: string; email: string; fullName: string; phone: string | null; role: string; kycStatus: string; createdAt: string; _count?: { rentals: number; orders: number } };
const tabs: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: 'tong-quan', label: 'Tổng quan', icon: ClipboardList },
  { id: 'don-thue', label: 'Đơn thuê', icon: Camera },
  { id: 'kho-may', label: 'Kho máy', icon: Package },
  { id: 'don-mua', label: 'Đơn mua', icon: ArrowUpRight },
  { id: 'nguoi-dung', label: 'Thành viên', icon: Users }
];
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' đ';
const statusName: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng', RESERVED: 'Đã giữ chỗ', RENTED: 'Đang cho thuê', MAINTENANCE: 'Bảo dưỡng', SOLD: 'Đã bán',
  PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', ACTIVE_RENTAL: 'Đang thuê', RETURNED_PENDING_INSPECTION: 'Chờ nghiệm thu',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', PAID: 'Đã ghi nhận', DELIVERING: 'Đang giao',
  UNVERIFIED: 'Chưa xác minh', PENDING: 'Chờ xử lý', VERIFIED: 'Đã xác minh', REJECTED: 'Bị từ chối',
  HELD: 'Ghi là đang giữ', REFUNDED: 'Ghi là đã hoàn', DEDUCTED: 'Ghi là đã khấu trừ',
  CREATING: 'Đang tạo', WAITING: 'Chờ quét', FAILED: 'Thất bại', REVIEW: 'Cần đối soát'
};
const label = (status: string) => statusName[status] ?? status;

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = tabs.some((item) => item.id === requested) ? requested as Tab : 'tong-quan';
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [users, setUsers] = useState<ListedUser[] | null>(null);
  const [models, setModels] = useState<{ id: number; modelName: string; brand: string }[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [form, setForm] = useState({ shutterCount: '', conditionGrade: '', sensorInspection: '', opticsCondition: '', scratchNotes: '' });
  const [newItem, setNewItem] = useState({ serialNumber: '', modelId: '', conditionGrade: 'A (98%)', shutterCount: '', opticsCondition: '', scratchNotes: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true);
    const endpoint = {
      'tong-quan': '/api/admin/stats',
      'don-thue': '/api/admin/bookings',
      'kho-may': '/api/admin/inventory',
      'don-mua': '/api/admin/orders',
      'nguoi-dung': '/api/admin/users'
    }[tab] as `/api/${string}`;
    const search = new URLSearchParams();
    if (tab !== 'tong-quan' && query.trim()) search.set('q', query.trim());
    if (statusFilter) search.set(tab === 'nguoi-dung' ? 'kycStatus' : 'status', statusFilter);
    const url = `${endpoint}${search.size ? `?${search}` : ''}` as `/api/${string}`;
    const timer = window.setTimeout(() => { apiRequest<{ stats?: Stats; data?: Booking[] | InventoryItem[] | Order[] | ListedUser[] }>(url, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (tab === 'tong-quan') setStats(result.stats || null);
        if (tab === 'don-thue') setBookings(result.data as Booking[]);
        if (tab === 'kho-may') setInventory(result.data as InventoryItem[]);
        if (tab === 'don-mua') setOrders(result.data as Order[]);
        if (tab === 'nguoi-dung') setUsers(result.data as ListedUser[]);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query.trim() ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [tab, query, statusFilter]);

  useEffect(() => {
    if (tab !== 'kho-may') return;
    const controller = new AbortController();
    apiRequest<{ data: { id: number; modelName: string; brand: string }[] }>('/api/admin/models', { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setModels(result.data); })
      .catch(() => { if (!controller.signal.aborted) setModels([]); });
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
    setBusy(true); setMessage(''); setError('');
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu thiết bị'); }
    finally { setBusy(false); }
  };

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!newItem.modelId) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await apiRequest<{ data: InventoryItem }>('/api/admin/inventory', {
        method: 'POST', body: JSON.stringify({
          serialNumber: newItem.serialNumber.trim(), modelId: Number(newItem.modelId),
          conditionGrade: newItem.conditionGrade.trim(), shutterCount: newItem.shutterCount ? Number(newItem.shutterCount) : null,
          depositAmount: 0, opticsCondition: newItem.opticsCondition.trim(),
          scratchNotes: newItem.scratchNotes.trim(), status: 'MAINTENANCE'
        })
      });
      setInventory((items) => [result.data, ...(items || [])]);
      selectItem(result.data); setShowCreate(false);
      setNewItem({ serialNumber: '', modelId: '', conditionGrade: 'A (98%)', shutterCount: '', opticsCondition: '', scratchNotes: '' });
      setMessage('Đã thêm máy ở trạng thái bảo dưỡng. Kiểm tra thông số và tình trạng thực tế trước khi mở cho thuê.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể thêm máy'); }
    finally { setBusy(false); }
  };

  const changeAvailability = async (item: InventoryItem) => {
    if (item.status !== 'AVAILABLE' && item.status !== 'MAINTENANCE') return;
    setBusy(true); setMessage(''); setError('');
    try {
      const target = item.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
      const result = await apiRequest<{ data: InventoryItem }>(`/api/admin/inventory/${encodeURIComponent(item.serialNumber)}`, {
        method: 'PATCH', body: JSON.stringify({ status: target })
      });
      setInventory((items) => items?.map((current) => current.id === item.id ? result.data : current) || null);
      setMessage(target === 'AVAILABLE' ? 'Máy đã được ghi là sẵn sàng trong kho.' : 'Máy đã được chuyển sang bảo dưỡng.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đổi trạng thái máy'); }
    finally { setBusy(false); }
  };

  const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-5 border-b border-film-border pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-film-warm">Filmiliar / Điều hành</p>
          <h1 className="mt-2 break-words text-3xl font-bold text-white sm:text-4xl">Trung tâm quản trị</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Theo dõi đơn và tài sản theo từng chiếc máy. Thông số kho là dữ liệu đang lưu; khoản cọc, eKYC và bảo hành chưa được xác nhận bằng quy trình thực tế.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-film-warm/40 bg-film-warm/10 px-4 py-3 text-sm text-film-warm">
          <ShieldCheck className="h-5 w-5 shrink-0" /> Chỉ tài khoản quản trị truy cập
        </div>
      </div>
      <nav aria-label="Mục quản trị" className="mt-6 grid grid-cols-2 gap-2 border-b border-film-border pb-5 sm:grid-cols-5">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => { setMessage(''); setError(''); setQuery(''); setStatusFilter(''); setParams({ tab: item.id }); }} aria-pressed={tab === item.id}
          className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm sm:text-sm ${item.id === 'nguoi-dung' ? 'col-span-2 sm:col-span-1' : ''} ${tab === item.id ? 'bg-film-warm text-film-dark' : 'bg-film-card text-slate-200 hover:bg-film-card/70 hover:text-white'}`}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{item.label}
        </button>)}
      </nav>
      {tab !== 'tong-quan' && <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block"><span className="sr-only">Tìm trong {tabs.find((item) => item.id === tab)?.label}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="min-h-11 w-full rounded-lg border border-film-border bg-film-card pl-10 pr-3 text-base text-white placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, tên, serial hoặc email" maxLength={100} />
        </label>
        <label className="block"><span className="sr-only">Lọc trạng thái</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 w-full rounded-lg border border-film-border bg-film-card px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm">
          <option value="">Tất cả trạng thái</option>
          {(tab === 'don-thue' ? ['PENDING_PAYMENT','CONFIRMED','ACTIVE_RENTAL','RETURNED_PENDING_INSPECTION','COMPLETED','CANCELLED'] : tab === 'kho-may' ? ['AVAILABLE','RESERVED','RENTED','MAINTENANCE','SOLD'] : tab === 'don-mua' ? ['PENDING_PAYMENT','PAID','DELIVERING','COMPLETED','CANCELLED'] : ['UNVERIFIED','PENDING','VERIFIED','REJECTED']).map((status) => <option key={status} value={status}>{label(status)}</option>)}
        </select></label>
      </div>}
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-lg border border-film-border bg-film-card p-3 text-sm text-slate-200">{message}</p>}
      {loading && <p role="status" className="mt-4 text-sm text-slate-400">Đang cập nhật danh sách...</p>}

      {tab === 'tong-quan' && (stats ? <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Tài sản và yêu cầu đang ghi nhận</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Dòng máy', stats.totalModels],
            ['Chiếc máy', stats.totalUnits],
            ['Sẵn sàng', stats.availableUnits],
            ['Đã giữ chỗ', stats.reservedUnits],
            ['Đang cho thuê', stats.rentedUnits],
            ['Bảo dưỡng', stats.maintenanceUnits],
            ['Đã bán', stats.soldUnits],
            ['Đơn thuê', stats.totalBookings],
            ['Đơn mua', stats.totalOrders],
            ['Tỷ lệ máy ghi là đang thuê', stats.utilizationRate + '%']
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-film-border bg-film-card p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value}</p></div>)}
        </div>
        <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="flex items-center gap-2 font-bold text-white"><AlertTriangle className="h-5 w-5 text-film-warm" /> Việc cần xem</h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {[["Thuê đến hạn hôm nay", stats.alerts.dueTodayBookings], ["Thuê quá hạn", stats.alerts.overdueBookings], ["Hồ sơ ghi chờ duyệt", stats.alerts.pendingKycCount]].map(([name, count]) => <div key={name} className="rounded-lg border border-film-border bg-film-dark p-3"><dt className="text-xs leading-5 text-slate-400">{name}</dt><dd className="mt-1 text-xl font-bold text-white">{count}</dd></div>)}
            </dl>
          </div>
          <div className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-bold text-white">Dữ liệu cọc cần đối soát</h3>
            <p className="mt-3 text-sm text-slate-300">Bản ghi cũ HELD: <strong className="text-white">{money(stats.heldDepositAmount)}</strong></p>
            <p className="mt-2 text-sm text-slate-300">Lượt thử Sandbox HELD: <strong className="text-white">{money(stats.sandboxHeldDepositAmount)}</strong></p>
            <p className="mt-3 text-xs leading-5 text-amber-300">Trạng thái dữ liệu không chứng minh đã thu hoặc giữ tiền thật.</p>
          </div>
        </div>
      </section> : !error && <p role="status" className="mt-7 text-slate-400">Đang tải thống kê...</p>)}

      {tab === 'don-thue' && <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Hàng đợi đơn thuê</h2>
        <p className="mt-2 text-sm text-slate-400">Tra cứu theo mã đơn, khách hoặc serial. Bàn giao và hoàn cọc đang chờ quy trình, bằng chứng nhận trả máy và đối soát tiền.</p>
        {!bookings && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : bookings?.length === 0 ? <p className="mt-5 rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Không có đơn thuê phù hợp.</p> : <div className="mt-5 space-y-3">{bookings?.map((booking) =>
          <article key={booking.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-all font-semibold text-white">{booking.bookingCode}</h3><span className="rounded-full border border-film-border px-3 py-1 text-xs text-film-warm">{label(booking.status)}</span></div>
            <p className="mt-2 text-sm text-slate-200">{booking.cameraItem.product.modelName} · <span className="break-all font-mono">{booking.cameraItem.serialNumber}</span></p>
            <p className="mt-1 text-sm text-slate-400">{booking.user.fullName} · {booking.user.email}{booking.user.phone ? ` · ${booking.user.phone}` : ''}</p>
            <p className="mt-2 text-sm text-slate-400">Ngày thuê: {booking.startDate.slice(0, 10)} → {booking.endDate.slice(0, 10)} · Cọc trong dữ liệu: {label(booking.depositStatus)}</p>
            {booking.paymentAttempt && <p className="mt-2 break-all text-sm text-amber-300">ZaloPay Sandbox · {label(booking.paymentAttempt.status)} · GD {booking.paymentAttempt.appTransId}</p>}
            {booking.paymentAttempt?.reviewReason && <p className="mt-1 text-sm text-red-300">Cần đối soát: {booking.paymentAttempt.reviewReason}</p>}
            <div className="mt-4 border-t border-film-border pt-3 text-xs text-slate-400">Bàn giao · Nghiệm thu · Hoàn cọc: chưa mở thao tác</div>
          </article>)}</div>}
      </section>}

      {tab === 'kho-may' && <section className="mt-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-white">Kho máy theo serial</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Cập nhật bản ghi theo đúng chiếc máy. Chưa có ngày kiểm tra hoặc ảnh bằng chứng nên thông tin này chưa phải Passport đã xác minh.</p></div>
          <button type="button" onClick={() => setShowCreate((value) => !value)} aria-expanded={showCreate} className="min-h-11 rounded-lg border border-film-warm px-4 text-sm font-semibold text-film-warm hover:bg-film-warm/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm">{showCreate ? 'Đóng biểu mẫu' : '+ Thêm chiếc máy'}</button>
        </div>
        {showCreate && <form onSubmit={createItem} className="mt-5 grid gap-3 rounded-xl border border-film-warm/40 bg-film-card p-4 sm:grid-cols-2 sm:p-5">
          <h3 className="text-lg font-bold text-white sm:col-span-2">Thêm chiếc máy vào kho</h3>
          <p className="text-sm text-slate-400 sm:col-span-2">Máy mới bắt đầu ở trạng thái bảo dưỡng. Cọc được ghi 0 đ cho đến khi nhóm duyệt định mức.</p>
          <label className="block text-sm text-slate-200">Dòng máy<select required className={inputClass} value={newItem.modelId} onChange={(event) => setNewItem({ ...newItem, modelId: event.target.value })}><option value="">Chọn dòng máy</option>{models.map((model) => <option key={model.id} value={model.id}>{model.brand} · {model.modelName}</option>)}</select></label>
          <label className="block text-sm text-slate-200">Số serial<input required minLength={3} maxLength={64} className={inputClass} value={newItem.serialNumber} onChange={(event) => setNewItem({ ...newItem, serialNumber: event.target.value })} /></label>
          <label className="block text-sm text-slate-200">Mức ngoại hình<input required maxLength={16} className={inputClass} value={newItem.conditionGrade} onChange={(event) => setNewItem({ ...newItem, conditionGrade: event.target.value })} /></label>
          <label className="block text-sm text-slate-200">Số lần trập<input type="number" min={0} max={10000000} className={inputClass} value={newItem.shutterCount} onChange={(event) => setNewItem({ ...newItem, shutterCount: event.target.value })} /></label>
          <label className="block text-sm text-slate-200">Ống kính / ngàm<input required maxLength={500} className={inputClass} value={newItem.opticsCondition} onChange={(event) => setNewItem({ ...newItem, opticsCondition: event.target.value })} /></label>
          <label className="block text-sm text-slate-200">Ghi chú ngoại hình<input maxLength={500} className={inputClass} value={newItem.scratchNotes} onChange={(event) => setNewItem({ ...newItem, scratchNotes: event.target.value })} /></label>
          <button type="submit" disabled={busy || models.length === 0} className="min-h-11 rounded-lg bg-film-warm px-5 text-sm font-bold text-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm disabled:opacity-50 sm:col-span-2">{busy ? 'Đang lưu...' : 'Lưu chiếc máy'}</button>
        </form>}
        {!inventory && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <div className="space-y-2">{inventory?.length === 0 && <p className="rounded-xl border border-film-border bg-film-card p-5 text-slate-300">Không có máy phù hợp.</p>}{inventory?.map((item) =>
            <div key={item.id} className={`rounded-xl border p-3 ${selectedSerial === item.serialNumber ? 'border-film-warm bg-film-warm/10' : 'border-film-border bg-film-card'}`}>
              <button type="button" onClick={() => selectItem(item)} aria-pressed={selectedSerial === item.serialNumber} className="min-h-11 w-full rounded-lg p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm">
                <span className="block font-semibold text-white">{item.product.modelName}</span>
                <span className="mt-1 block break-all text-sm text-slate-400">{item.serialNumber} · {label(item.status)} · {item.conditionGrade}</span>
              </button>
              {(item.status === 'AVAILABLE' || item.status === 'MAINTENANCE') && <button type="button" disabled={busy} onClick={() => void changeAvailability(item)} className="mt-2 min-h-11 rounded-lg border border-film-border px-3 text-xs font-semibold text-film-warm hover:border-film-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm disabled:opacity-50">{item.status === 'AVAILABLE' ? 'Chuyển bảo dưỡng' : 'Ghi sẵn sàng'}</button>}
            </div>)}</div>
          {selectedSerial ? <form onSubmit={saveItem} className="h-fit space-y-3 rounded-xl border border-film-border bg-film-card p-5 lg:sticky lg:top-24">
            <h3 className="text-lg font-bold text-white">Sửa chiếc {selectedSerial}</h3>
            <label className="block text-sm text-slate-200">Số lần trập<input className={inputClass} type="number" min={0} max={10000000} value={form.shutterCount} onChange={(event) => setForm({ ...form, shutterCount: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Mức ngoại hình<input className={inputClass} required maxLength={16} value={form.conditionGrade} onChange={(event) => setForm({ ...form, conditionGrade: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Cảm biến<input className={inputClass} maxLength={500} value={form.sensorInspection} onChange={(event) => setForm({ ...form, sensorInspection: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Ống kính / ngàm<input className={inputClass} required maxLength={500} value={form.opticsCondition} onChange={(event) => setForm({ ...form, opticsCondition: event.target.value })} /></label>
            <label className="block text-sm text-slate-200">Ghi chú ngoại hình<input className={inputClass} maxLength={500} value={form.scratchNotes} onChange={(event) => setForm({ ...form, scratchNotes: event.target.value })} /></label>
            <p className="text-sm text-slate-400">Trạng thái kho: {label(inventory?.find((item) => item.serialNumber === selectedSerial)?.status || '')}. Nút đổi sẵn sàng/bảo dưỡng nằm trên danh sách; trạng thái thuê và bán chỉ thuộc quy trình đơn.</p>
            <button disabled={busy} className="min-h-11 rounded-lg bg-film-warm px-5 text-sm font-bold text-film-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-film-warm disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu bản ghi'}</button>
          </form> : <p className="text-sm text-slate-400">Chọn một chiếc máy để xem và sửa dữ liệu.</p>}
        </div>}
      </section>}

      {tab === 'don-mua' && <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Đơn mua máy cũ</h2>
        <p className="mt-2 text-sm text-slate-400">Xem bản ghi đơn và chiếc máy liên quan. Xác nhận đã thu tiền, đổi máy sang đã bán và kích hoạt bảo hành sẽ mở sau khi nhóm chốt chính sách và luồng thanh toán mua.</p>
        {!orders && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : orders?.length === 0 ? <p className="mt-5 rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Không có đơn mua phù hợp.</p> : <div className="mt-5 space-y-3">{orders?.map((order) =>
          <article key={order.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-all font-semibold text-white">{order.orderCode}</h3><span className="rounded-full border border-film-border px-3 py-1 text-xs text-film-warm">{label(order.status)}</span></div>
            <p className="mt-2 text-sm text-slate-200">{order.cameraItem.product.modelName} · <span className="break-all font-mono">{order.cameraItem.serialNumber}</span></p>
            <p className="mt-1 text-sm text-slate-400">{order.user.fullName} · {order.user.email}</p>
            <p className="mt-2 text-sm text-slate-300">Giá trị ghi trong đơn: {money(order.totalAmount)} · Ngày tạo: {order.createdAt.slice(0, 10)}</p>
            <p className="mt-3 border-t border-film-border pt-3 text-xs text-slate-400">Bảo hành {order.warrantyMonths || 6} tháng là dữ liệu trong đơn, chưa phải bảo hành đã kích hoạt.</p>
          </article>)}</div>}
      </section>}

      {tab === 'nguoi-dung' && <section className="mt-7">
        <h2 className="text-xl font-bold text-white">Thành viên</h2>
        <p className="mt-2 text-sm text-slate-400">Tra cứu hồ sơ cơ bản và số đơn. Giấy tờ định danh không hiển thị hoặc được nhận thêm qua hosting ảnh công khai; duyệt eKYC và đổi vai trò đang khóa.</p>
        {!users && !error ? <p role="status" className="mt-5 text-slate-400">Đang tải...</p> : users?.length === 0 ? <p className="mt-5 rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Không có thành viên phù hợp.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{users?.map((user) =>
          <article key={user.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-semibold text-white">{user.fullName}</h3>
            <p className="mt-1 break-all text-sm text-slate-300">{user.email}{user.phone ? ` · ${user.phone}` : ''}</p>
            <p className="mt-2 text-sm text-slate-400">Vai trò: {user.role} · Định danh trong dữ liệu: {label(user.kycStatus)}</p>
            <p className="mt-2 text-xs text-slate-400">{user._count?.rentals ?? 0} đơn thuê · {user._count?.orders ?? 0} đơn mua · Tham gia {user.createdAt.slice(0, 10)}</p>
          </article>)}</div>}
      </section>}
    </main>
  );
}
