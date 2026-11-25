import { NotificationKind } from '../teacher.models';

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-11-25T08:00" → "mié 25 nov, 08:00" (la hora ya viene en hora de Ecuador). */
export function fmtSchedule(v: string | null): string {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '—';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${DAYS[d.getDay()]} ${+m[3]} ${MONTHS[+m[2] - 1]}, ${m[4]}:${m[5]}`;
}

export function notificationIcon(kind: NotificationKind): string {
  return ({ nueva: 'assignment_add', cancelada: 'event_busy', rechazada: 'block', recordatorio: 'schedule' } as const)[kind];
}
