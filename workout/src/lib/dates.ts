export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function sundayOf(iso: string) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - d.getDay());
  return toISO(d);
}

export function formatPretty(iso: string) {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLong(iso: string) {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}

export function daysBetween(a: string, b: string) {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}
