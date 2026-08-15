// Todo el sistema trabaja con fechas "YYYY-MM-DD" en Europe/Madrid.
// Guardarlas como string y hacer la aritmetica en UTC evita el off-by-one
// clasico cuando el servidor de Vercel corre en otra zona horaria.

export const TZ = "Europe/Madrid";

/// "YYYY-MM-DD" de hoy en Madrid. El locale sueco da justo ese formato.
export function todayMadrid(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

/// Hora local (0-23) en Madrid ahora mismo.
export function hourMadrid(): number {
  return Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/// Dias enteros de `from` a `to`. Negativo si `to` ya paso.
export function diffDays(to: string, from: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

/// 0 domingo ... 6 sabado. Es el indice de `Settings.capacityByWeekday`.
export function weekdayIndex(date: string): number {
  return toUTC(date).getUTCDay();
}

/// Lunes de la semana de `date`. La semana empieza en lunes, como la vida.
export function weekStart(date: string): string {
  const dow = weekdayIndex(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export function weekdayLabel(date: string): string {
  return WEEKDAYS[weekdayIndex(date)];
}

/// "2h 30'" / "45'" / "2h"
export function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}'`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}'`;
}

/// "hoy" / "manana" / "en 4 dias" / "hace 2 dias"
export function relativeDays(target: string, from: string): string {
  const d = diffDays(target, from);
  if (d === 0) return "hoy";
  if (d === 1) return "manana";
  if (d === -1) return "ayer";
  if (d > 1) return `en ${d} dias`;
  return `hace ${-d} dias`;
}

/// "vie 15 ago"
export function shortLabel(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(toUTC(date));
}
