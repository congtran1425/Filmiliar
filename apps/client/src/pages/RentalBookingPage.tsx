import { Link, useParams } from 'react-router-dom';
import { RentalBookingDetail } from '../components/RentalBookingDetail';

export function RentalBookingPage() {
  const { id } = useParams();
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"><Link to="/tai-khoan?tab=thue" className="mb-5 inline-flex min-h-11 items-center text-sm text-film-warm">← Đơn thuê của tôi</Link>{id ? <RentalBookingDetail bookingId={id}/> : <p>Không tìm thấy đơn.</p>}</main>;
}
