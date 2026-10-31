/** Normalize contact numbers without claiming ownership or identity verification. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 30 || !/^[+0-9\s().-]+$/.test(value)) return null;
  let phone = value.replace(/[\s().-]/g, '');
  if (/^\+84\d{9,10}$/.test(phone)) phone = '0' + phone.slice(3);
  return /^(?:0\d{9,10}|\+[1-9]\d{7,14})$/.test(phone) ? phone : null;
}
