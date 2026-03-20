export function withFrom(path: string, from: string | null | undefined): string {
  if (!from) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}from=${encodeURIComponent(from)}`;
}

export function getParam(searchParams: URLSearchParams, key: string): string | null {
  const v = searchParams.get(key);
  return v && v.trim().length > 0 ? v : null;
}

export function getIntParam(
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = searchParams.get(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function setOrDelete(
  searchParams: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) {
  const v = value == null ? "" : String(value);
  if (!v) searchParams.delete(key);
  else searchParams.set(key, v);
}


