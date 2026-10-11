// This value is bundled into the browser. It must contain only the public API origin.
const apiOrigin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path: `/api/${string}`): string {
  return `${apiOrigin}${path}`;
}
