import { formatVnd, type CameraUnit } from '../lib/catalog';

export function UnitPassport({ unit }: { unit: CameraUnit }) {
  const passport = unit.passport;
  if (!passport) return null;
  return <section className="min-w-0 rounded-2xl border border-film-border bg-film-card p-4 sm:p-5" aria-label={`Hồ sơ ${passport.assetCode}`}>
    <p className="font-mono text-xs text-film-warm">{passport.assetCode} · {unit.serialNumber}</p>
    <h2 className="mt-2 text-lg font-bold text-white">Hồ sơ chiếc máy</h2>
    <p className="mt-2 text-sm leading-6 text-slate-300">{passport.kit}</p>
    <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-film-border pt-4 text-sm">
      {[["Tình trạng",`${passport.overallPercent}%`],["Số lần trập",unit.shutterCount?.toLocaleString('vi-VN') ?? 'Chưa đo'],["Pin",`${passport.battery.model} · ${passport.battery.healthPercent}%`],["Ngày nhập",passport.acquiredOn.split('-').reverse().join('/')],["Giá trị cả bộ",formatVnd(passport.referenceValue)],[`Cọc ${passport.depositPercent}%`,formatVnd(unit.depositAmount ?? 0)]].map(([name,value]) => <div key={name} className="min-w-0"><dt className="text-xs text-slate-400">{name}</dt><dd className="mt-1 break-words font-semibold text-white">{value}</dd></div>)}
    </dl>
    <details className="mt-5 border-t border-film-border pt-2" open><summary className="flex min-h-11 cursor-pointer items-center font-semibold text-white">Tình trạng từng bộ phận</summary><dl className="space-y-3 pb-2">{passport.parts.map(part => <div key={part.name} className="border-l-2 border-film-teal pl-3 text-sm"><dt className="font-medium text-white">{part.name} · {part.percent}%</dt><dd className="mt-1 text-xs leading-6 text-slate-300">{part.notes}</dd></div>)}</dl></details>
    <details className="mt-2 border-t border-film-border pt-2"><summary className="flex min-h-11 cursor-pointer items-center font-semibold text-white">Phụ kiện và kiểm tra chức năng</summary><p className="text-sm leading-7 text-slate-300">{passport.accessories.join(' · ')}</p><ul className="mt-3 space-y-2 text-xs text-slate-300">{passport.checks.map(check => <li key={check}>✓ {check} · đạt theo hồ sơ</li>)}</ul><p className="mt-4 text-xs leading-6 text-slate-400">Lịch sử sửa chữa: {passport.repairHistory.length ? passport.repairHistory.join('; ') : 'Chưa ghi nhận trong hồ sơ'}. Nguồn nhập: {passport.supplier}.</p><p className="mt-2 text-xs text-slate-400">Nguồn hồ sơ: {passport.source}{passport.kind === 'SIMULATED' ? ' · mô phỏng' : ''}.</p></details>
  </section>;
}
