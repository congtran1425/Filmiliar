/* Hallmark · pre-emit critique: P4 H4 E4 S5 R4 V4 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest, useSession } from '../lib/session';
import type { SessionUser } from '../lib/session';

type Tab = 'ho-so' | 'dinh-danh' | 'thue' | 'mua';
type Rental = {
  id: string; bookingCode: string; status: string; depositStatus: string;
  startDate: string; endDate: string; totalRentalFee: number;
  cameraItem: { serialNumber: string; product: { modelName: string; slug: string } };
};
type Order = {
  id: string; orderCode: string; status: string; createdAt: string;
  cameraItem: { serialNumber: string; product: { modelName: string; slug: string } };
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'ho-so', label: 'Hồ sơ & bảo mật' },
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
  const { user, updateUser, updateToken } = useSession();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = tabs.some((item) => item.id === requested) ? requested as Tab : 'ho-so';
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
      const result = await apiRequest<{ user: SessionUser }>('/api/user/profile', {
        method: 'PUT', body: JSON.stringify({ fullName, phone: phone || null, address: address || null })
      });
      updateUser(result.user);
      setMessage('Đã cập nhật hồ sơ.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể cập nhật'); }
    finally { setBusy(false); }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await apiRequest<{ token: string }>('/api/user/change-password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword })
      });
      updateToken(result.token);
      setCurrentPassword(''); setNewPassword('');
      setMessage('Đã đổi mật khẩu. Các phiên dùng mật khẩu cũ không còn hợp lệ.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu'); }
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
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => { setMessage(''); setParams({ tab: item.id }); }}
          aria-current={tab === item.id ? 'page' : undefined}
          className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold ${tab === item.id ? 'bg-film-warm text-film-dark' : 'bg-film-card text-slate-200 hover:text-white'}`}>{item.label}</button>)}
      </nav>
      {message && <p role="status" className="mt-5 rounded-lg border border-film-border bg-film-card p-3 text-sm text-slate-200">{message}</p>}

      {tab === 'ho-so' && <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-film-border bg-film-card p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">Hồ sơ cá nhân</h2>
          <p className="text-sm text-slate-400">Email đăng nhập: {user.email}</p>
          <label className="block text-sm text-slate-200">Họ và tên<input className={inputClass} required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label className="block text-sm text-slate-200">Số điện thoại<input className={inputClass} type="tel" maxLength={30} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label className="block text-sm text-slate-200">Địa chỉ liên hệ<input className={inputClass} maxLength={500} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <button disabled={busy} className="min-h-11 rounded-lg bg-film-warm px-5 text-sm font-bold text-film-dark disabled:opacity-50">Lưu hồ sơ</button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-film-border bg-film-card p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">Đổi mật khẩu</h2>
          <label className="block text-sm text-slate-200">Mật khẩu hiện tại<input className={inputClass} type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label className="block text-sm text-slate-200">Mật khẩu mới<input className={inputClass} type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <p className="text-xs text-slate-400">Ít nhất 10 ký tự và khác mật khẩu hiện tại.</p>
          <button disabled={busy} className="min-h-11 rounded-lg border border-film-warm px-5 text-sm font-bold text-film-warm disabled:opacity-50">Đổi mật khẩu</button>
        </form>
      </div>}

      {tab === 'dinh-danh' && <section className="mt-7 max-w-3xl rounded-2xl border border-film-border bg-film-card p-5 sm:p-6">
        <h2 className="text-xl font-bold text-white">Trạng thái định danh</h2>
        <p className="mt-4 inline-block rounded-lg bg-film-warm/15 px-3 py-2 text-sm font-semibold text-film-warm">{kycLabels[user.kycStatus]}</p>
        <p className="mt-5 text-sm leading-6 text-slate-300">Filmiliar chưa tiếp nhận ảnh CCCD hoặc giấy tờ định danh qua website. Hosting ảnh hiện tại phục vụ tệp công khai; nhóm cần nơi lưu riêng và quy trình duyệt trước khi mở bước này.</p>
        <p className="mt-3 text-sm text-slate-400">Trạng thái này không thay đổi giá thuê, tiền cọc hoặc quyền đặt máy.</p>
      </section>}

      {tab === 'thue' && <section className="mt-7 space-y-4">
        <h2 className="text-xl font-bold text-white">Đơn thuê đã ghi nhận</h2>
        <p className="text-sm text-slate-400">Website hiện chưa tạo đơn mới hoặc thu cọc. Dữ liệu bên dưới chỉ xuất hiện nếu đã có bản ghi trong hệ thống.</p>
        {listError ? <p role="alert" className="text-red-300">{listError}</p> : !rentals ? <p role="status" className="text-slate-400">Đang tải...</p> : rentals.length === 0 ? <p className="rounded-xl border border-film-border bg-film-card p-6 text-slate-300">Bạn chưa có đơn thuê nào.</p> : rentals.map((rental) =>
          <article key={rental.id} className="rounded-xl border border-film-border bg-film-card p-5">
            <h3 className="font-semibold text-white">{rental.cameraItem.product.modelName}</h3>
            <p className="mt-1 text-sm text-slate-300">Mã {rental.bookingCode} · chiếc {rental.cameraItem.serialNumber}</p>
            <p className="mt-2 text-sm text-slate-400">Trạng thái đơn: {rental.status} · Trạng thái cọc trong dữ liệu: {rental.depositStatus}</p>
            <p className="mt-1 text-sm text-slate-400">Tiền thuê ghi nhận: {money(rental.totalRentalFee)}</p>
            <Link to={`/thiet-bi/${rental.cameraItem.product.slug}`} className="mt-3 inline-block text-sm font-semibold text-film-warm underline">Xem thiết bị</Link>
          </article>)}
      </section>}

      {tab === 'mua' && <section className="mt-7 space-y-4">
        <h2 className="text-xl font-bold text-white">Đơn mua đã ghi nhận</h2>
        <p className="text-sm text-slate-400">Chưa mở mua và thanh toán trực tuyến; bảo hành chưa có quy tắc được nhóm duyệt.</p>
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
