const TZ = 'America/Guayaquil';
const dt = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const d = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });

/** Fecha y hora en hora de Ecuador. */
export function fmtDateTime(v?: string | null): string { return v ? dt.format(new Date(v)) : '—'; }
export function fmtDate(v?: string | null): string { return v ? d.format(new Date(v)) : '—'; }

/** "hace 5 min", "hace 2 h", "hace 3 d". */
export function fmtAgo(v?: string | null): string {
  if (!v) return '—';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `hace ${Math.floor(s / 86400)} d`;
  return fmtDate(v);
}

/** Valor para <input type="datetime-local"> en hora de Ecuador (UTC-5, sin horario de verano). */
export function toLocalInput(v?: string | null): string {
  if (!v) return '';
  const t = new Date(new Date(v).getTime() - 5 * 3600 * 1000);
  return t.toISOString().slice(0, 16);
}

/** Mismas etiquetas que el panel original (ESTADO_LABELS), para que ADMIN, SUPERADMIN y estudiante hablen igual. */
export const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado', cancelado: 'Cancelado',
};
export const STATUS_ORDER = ['pendiente', 'en_revision', 'aprobado', 'rechazado', 'cancelado'];
export const ROLE_LABELS: Record<string, string> = { STUDENT: 'Estudiante', TEACHER: 'Docente', ADMIN: 'Administrador', SUPERADMIN: 'Super Administrador', SYSTEM: 'Sistema' };

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
