/* Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V4 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest, useSession } from '../lib/session';
import type { SessionUser } from '../lib/session';
import { normalizePhone } from '../lib/phone';

type Tab = 'ho-so' | 'dinh-danh' | 'thue' | 'mua';
type Rental = {
  id: string; bookingCode: string; status: string; depositStatus: string;
  startDate: string; endDate: string; totalRentalFee: number;
  cameraItem: { serialNumber: string; product: { modelName: string; slug: string } };
  paymentAttempt: { status: string; appTransId: string } | null;
};
type Order = {
  id: string; orderCode: string; status: string; createdAt: string;
  cameraItem: { serialNumber: string; product: { modelName: string; slug: string } };
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'ho-so', label: 'Hồ sơ' },
  { id: 'dinh-danh', label: 'Định danh' },
  { id: 'thue', label: 'Đơn thuê' },
  { id: 'mua', label: 'Đơn mua' }
];
const kycLabels: Record<SessionUser['kycStatus'], string> = {
  UNVERIFIED: 'Chưa xác minh',
  PENDING: 'Đang chờ duyệt',
  VERIFIED: 'Đã ghi nhận xác minh',
  REJECTED: 'Chưa được chấp nhận'
};
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' đ';

export function AccountPage() {
  const { user, updateUser } = useSession();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = tabs.some((item) => item.id === requested) ? requested as Tab : 'ho-so';
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rentals, setRentals] = useState<Rental[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [listError, setListError] = useState('');

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phone || '');
    setAddress(user.address || '');
  }, [user]);

  useEffect(() => {
    if (tab !== 'thue' && tab !== 'mua') return;
    const controller = new AbortController();
    setListError('');
    const path = tab === 'thue' ? '/api/user/rentals' : '/api/user/orders';
    apiRequest<{ data: Rental[] | Order[] }>(path, { signal: controller.signal })
      .then((result) => {
        if (tab === 'thue') setRentals(result.data as Rental[]);
        else setOrders(result.data as Order[]);
      })
      .catch((error) => { if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : 'Không thể tải dữ liệu'); });
    return () => controller.abort();
  }, [tab]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) throw new Error('Vui lòng nhập số điện thoại hợp lệ, ví dụ 0912345678 hoặc +84 912345678.');
      const result = await apiRequest<{ user: SessionUser }>('/api/user/profile', {
        method: 'PUT', body: JSON.stringify({ fullName, phone: normalizedPhone, address: address || null })
      });
      updateUser(result.user);
      setEditing(false);
      setMessage('Đã cập nhật hồ sơ.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể cập nhật'); }
    finally { setBusy(false); }
  };

  if (!user) return null;
  const inputClass = 'mt-1.5 min-h-12 w-full rounded-lg border border-film-border bg-film-dark px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm';
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-film-warm">Không gian cá nhân</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Tài khoản của bạn</h1>
      <p className="mt-2 text-sm text-slate-300">{user.email} · {user.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}</p>
      <nav aria-label="Mục tài khoản" className="mt-7 flex gap-2 overflow-x-auto border-b border-film-border pb-3">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => { setEditing(false); setMessage(''); setParams({ tab: item.id }); }}
          aria-current={tab === item.id ? 'page' : undefined}
          className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold ${tab === item.id ? 'bg-film-warm text-film-dark' : 'bg-film-card text-slate-200 hover:text-white'}`}>{item.label}</button>)}
      </nav>
      {message && <p role="status" className="mt-5 rounded-lg border border-film-border bg-film-card p-3 text-sm text-slate-200">{message}</p>}

      {tab === 'ho-so' && <div className="mt-7 max-w-3xl">
        {!editing ? <section className="rounded-2xl border border-film-border bg-film-card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">Hồ sơ cá nhân</h2><button type="button" onClick={() => { setFullName(user.fullName); setPhone(user.phone || ''); setAddress(user.address || ''); setMessage(''); setEditing(true); }} className="min-h-11 rounded-lg bg-film-warm px-4 text-sm font-bold text-film-dark">Cập nhật thông tin</button></div>
          <dl className="mt-6 divide-y divide-film-border text-sm">{[['Họ và tên',user.fullName],['Số điện thoại',user.phone || 'Chưa bổ sung'],['Email đăng nhập',user.email],['Địa chỉ liên hệ',user.address || 'Chưa bổ sung']].map(([name,value]) => <div key={name} className="grid gap-2 py-4 sm:grid-cols-[170px_minmax(0,1fr)]"><dt className="text-slate-400">{name}</dt><dd className="break-words text-base text-white">{value}</dd></div>)}</dl>
        </section> :
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-film-border bg-film-card p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">Cập nhật thông tin</h2>
          <p className="text-sm text-slate-400">Email đăng nhập: {user.email}</p>
          <label className="block text-sm text-slate-200">Họ và tên<input autoFocus className={inputClass} required placeholder="VD: Nguyễn Minh Anh" minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label className="block text-sm text-slate-200">Số điện thoại<input className={inputClass} required type="tel" inputMode="tel" placeholder="VD: 0912 345 678" maxLength={30} autoComplete="tel" aria-describedby="profile-phone-hint" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <p id="profile-phone-hint" className="text-xs leading-5 text-slate-400">Bắt buộc để liên hệ khi nhận máy. Có thể nhập số bắt đầu bằng +84.</p>
          <label className="block text-sm text-slate-200">Địa chỉ liên hệ (không bắt buộc)<input className={inputClass} placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành" maxLength={500} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <div className="flex gap-3"><button disabled={busy} className="min-h-11 rounded-lg bg-film-warm px-5 text-sm font-bold text-film-dark disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button><button type="button" disabled={busy} onClick={() => { setEditing(false); setMessage(''); setFullName(user.fullName); setPhone(user.phone || ''); setAddress(user.address || ''); }} className="min-h-11 rounded-lg border border-film-border px-5 text-sm font-semibold text-slate-200">Hủy</button></div>
        </form>
        }
      </div>}

      {tab === 'dinh-danh' && <section className="mt-7 max-w-3xl rounded-2xl border border-film-border bg-film-card p-5 sm:p-6">
        <h2 className="text-xl font-bold text-white">Trạng thái định danh</h2>
        <p className="mt-4 inline-block rounded-lg bg-film-warm/15 px-3 py-2 text-sm font-semibold text-film-warm">{kycLabels[user.kycStatus]}</p>
        <p className="mt-5 text-sm leading-6 text-slate-300">Đối chiếu thông tin người nhận trực tiếp khi bàn giao máy.</p>
        <p className="mt-3 text-sm text-slate-400">Trạng thái này không thay đổi giá thuê, tiền cọc hoặc quyền đặt máy.</p>
      </section>}

      {tab === 'thue' && <section className="mt-7 space-y-4">
        <h2 className="text-xl font-bold text-white">Đơn thuê đã ghi nhận</h2>
        <p className="text-sm text-slate-400">Theo dõi lịch thuê, biên bản bàn giao và tiến trình hoàn cọc.</p>
        {listError ? <p role="alert" className="text-red-300">{listError}</p> : !rentals ? <p role="status" className="text-slate-400">Đang tải...</p> : rentals.length === 0 ? <p className="rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Bạn chưa có đơn thuê nào.</p> : rentals.map((rental) =>
          <article key={rental.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-semibold text-white">{rental.cameraItem.product.modelName}</h3>
            <p className="mt-1 text-sm text-slate-300">Mã {rental.bookingCode} · chiếc {rental.cameraItem.serialNumber}</p>
            <p className="mt-2 text-sm text-slate-400">Trạng thái đơn: {rental.status} · Cọc: {rental.depositStatus}</p>
            {rental.paymentAttempt && <p className="mt-1 text-sm text-amber-300">ZaloPay Sandbox · {rental.paymentAttempt.status}</p>}
            <p className="mt-1 text-sm text-slate-400">Tiền thuê ghi nhận: {money(rental.totalRentalFee)}</p>
            <div className="mt-3 flex flex-wrap gap-4"><Link to={`/tai-khoan/don-thue/${rental.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-film-warm underline">Hồ sơ đơn và hoàn cọc</Link><Link to={`/thiet-bi/${rental.cameraItem.product.slug}`} className="inline-flex min-h-11 items-center text-sm text-slate-300 underline">Xem thiết bị</Link></div>
          </article>)}
      </section>}

      {tab === 'mua' && <section className="mt-7 space-y-4">
        <h2 className="text-xl font-bold text-white">Đơn mua đã ghi nhận</h2>
        <p className="text-sm text-slate-400">Lịch sử mua máy và hồ sơ của từng chiếc.</p>
        {listError ? <p role="alert" className="text-red-300">{listError}</p> : !orders ? <p role="status" className="text-slate-400">Đang tải...</p> : orders.length === 0 ? <p className="rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Bạn chưa có đơn mua nào.</p> : orders.map((order) =>
          <article key={order.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-semibold text-white">{order.cameraItem.product.modelName}</h3>
            <p className="mt-1 text-sm text-slate-300">Mã {order.orderCode} · chiếc {order.cameraItem.serialNumber}</p>
            <p className="mt-2 text-sm text-slate-400">Trạng thái đơn: {order.status}</p>
          </article>)}
      </section>}
    </main>
  );
}
