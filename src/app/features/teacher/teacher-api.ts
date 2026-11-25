import { HttpClient } from '@angular/common/http';
import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/config';
import { COURSE_LABELS_SHORT } from '../../core/catalogs';
import {
  CLOSED_REQUEST, TRACK_LABELS, TeacherItem, TeacherItemDetail, TeacherItemFilters, TeacherNotification, TeacherProfile, TeacherSubject, TrackStatus, TrackUpdate,
} from './teacher.models';

/**
 * Acceso a datos del panel docente. Las pantallas solo conocen esta clase; hoy se provee `DemoTeacherApi`
 * y, cuando exista el backend, una implementación HTTP con los mismos métodos.
 */
export abstract class TeacherApi {
  /** true mientras se muestran datos de ejemplo (aviso visible en el panel). */
  abstract readonly isDemo: boolean;
  /** Notificaciones sin leer (lo usa el riel y el aviso al ingresar). */
  abstract readonly unread: WritableSignal<number>;
  abstract profile(): Promise<TeacherProfile>;
  abstract subjects(): Promise<TeacherSubject[]>;
  abstract items(filters?: TeacherItemFilters): Promise<TeacherItem[]>;
  abstract item(id: string): Promise<TeacherItemDetail>;
  abstract pdf(id: string): Promise<Blob>;
  abstract updateTrack(ids: string[], update: TrackUpdate): Promise<TeacherItem[]>;
  abstract notifications(): Promise<TeacherNotification[]>;
  abstract markRead(ids: string[] | 'all'): Promise<void>;
}

// ── Datos de ejemplo (nombres inventados) ─────────────────────────────────────
const STUDENTS = [
  'Mateo Sebastián Ordóñez Vintimilla', 'Valentina Isabel Cárdenas Peña', 'Joaquín Andrés Guzmán Torres',
  'Camila Fernanda Rivera Mora', 'Santiago José Pesántez Ochoa', 'Isabella María Álvarez Crespo',
  'Martín Alejandro Vázquez León', 'Emilia Sofía Jaramillo Ortiz', 'Nicolás David Zhunio Patiño',
  'Antonella Paz Merchán Idrovo', 'Benjamín Esteban Coronel Calle', 'Renata Lucía Arévalo Palacios',
  'Thiago Daniel Sigüenza Rojas', 'Luciana Abigail Tenesaca Quito', 'Gabriel Ignacio Vintimilla Neira',
  'Paula Andrea Bermeo Saquicela',
];
const ASSIGN: { subject: string; course: string; paralelo: string; specialty: string | null }[] = [
  { subject: 'Estudios Sociales', course: '9no', paralelo: 'A', specialty: null },
  { subject: 'Estudios Sociales', course: '9no', paralelo: 'B', specialty: null },
  { subject: 'Historia', course: '1ro_Bach', paralelo: 'E1', specialty: 'Desarrollo de Software' },
  { subject: 'Historia', course: '1ro_Bach', paralelo: 'E2', specialty: 'Desarrollo de Software' },
  { subject: 'Educación para la Ciudadanía', course: '2do_Bach', paralelo: 'F1', specialty: 'Ciencias' },
];

const key = (a: { subject: string; course: string; paralelo: string }) => `${a.course}|${a.paralelo}|${a.subject}`;
const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const local = (daysAhead: number, h: number) => {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(h)}:00`;
};

function seedItems(lastVisit: string): TeacherItem[] {
  // [asignación, horas atrás, estado admin, seguimiento, programada]
  const plan: [number, number, string, TrackStatus, string | null][] = [
    [0, 2, 'pendiente', 'por_atender', null], [0, 5, 'en_revision', 'por_atender', null], [1, 3, 'pendiente', 'por_atender', null],
    [2, 1, 'pendiente', 'por_atender', null], [3, 20, 'aprobado', 'por_atender', null], [2, 30, 'aprobado', 'programada', local(2, 8)],
    [0, 52, 'aprobado', 'programada', local(1, 10)], [1, 70, 'aprobado', 'evaluado', null], [4, 26, 'aprobado', 'por_atender', null],
    [3, 96, 'aprobado', 'evaluado', null], [4, 120, 'cancelado', 'por_atender', null], [1, 140, 'rechazado', 'por_atender', null],
    [2, 150, 'aprobado', 'evaluado', null], [0, 170, 'aprobado', 'evaluado', null],
  ];
  return plan.map(([a, h, st, tr, sch], i) => {
    const as = ASSIGN[a];
    const submittedAt = iso(h);
    return {
      id: `demo-${i + 1}`, requestId: `req-${i + 1}`, requestNumber: `PM-2026-${String(120 - i).padStart(4, '0')}`,
      studentName: STUDENTS[i % STUDENTS.length], course: as.course, paralelo: as.paralelo, specialty: as.specialty,
      subject: as.subject, requestStatus: st, submittedAt, track: tr, scheduledAt: sch, note: null,
      isNew: submittedAt > lastVisit,
    };
  });
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Implementación en memoria para diseñar y probar el panel sin backend. Los cambios se pierden al recargar. */
@Injectable()
export class DemoTeacherApi extends TeacherApi {
  readonly isDemo = true;
  readonly unread = signal(0);
  private readonly lastVisit = iso(8);
  private data = seedItems(this.lastVisit);
  private notes: TeacherNotification[] = this.seedNotifications();

  constructor() {
    super();
    this.unread.set(this.notes.filter((n) => !n.read).length);
  }

  private seedNotifications(): TeacherNotification[] {
    const out: TeacherNotification[] = this.data.filter((i) => i.isNew).map((i) => ({
      id: `n-${i.id}`, kind: 'nueva', title: `Nueva solicitud de ${i.subject}`,
      body: `${i.studentName} · ${COURSE_LABELS_SHORT[i.course] ?? i.course} ${i.paralelo}`, createdAt: i.submittedAt, read: false, itemId: i.id,
    }));
    const canc = this.data.find((i) => i.requestStatus === 'cancelado');
    if (canc) out.push({ id: 'n-canc', kind: 'cancelada', title: 'Solicitud cancelada por el estudiante',
      body: `${canc.studentName} ya no rendirá ${canc.subject}.`, createdAt: iso(6), read: false, itemId: canc.id });
    const sched = this.data.find((i) => i.track === 'programada');
    if (sched) out.push({ id: 'n-rec', kind: 'recordatorio', title: 'Evaluación programada para mañana',
      body: `${sched.studentName} · ${sched.subject}`, createdAt: iso(30), read: true, itemId: sched.id });
    const rech = this.data.find((i) => i.requestStatus === 'rechazado');
    if (rech) out.push({ id: 'n-rech', kind: 'rechazada', title: 'Solicitud rechazada por la administración',
      body: `${rech.studentName} · ${rech.subject}: no requiere evaluación.`, createdAt: iso(100), read: true, itemId: rech.id });
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private wait<T>(v: T): Promise<T> {
    return new Promise((r) => setTimeout(() => r(structuredClone(v)), 250));
  }

  profile(): Promise<TeacherProfile> {
    return this.wait({ name: 'Docente de ejemplo', email: 'docente.ejemplo@uets.edu.ec', lastVisitAt: this.lastVisit });
  }

  subjects(): Promise<TeacherSubject[]> {
    return this.wait(ASSIGN.map((a) => {
      const mine = this.data.filter((i) => key(i) === key(a) && !CLOSED_REQUEST.has(i.requestStatus));
      return { key: key(a), ...a, total: mine.length, porAtender: mine.filter((i) => i.track === 'por_atender').length,
        nuevas: mine.filter((i) => i.isNew).length };
    }));
  }

  items(f: TeacherItemFilters = {}): Promise<TeacherItem[]> {
    const q = fold(f.search?.trim() ?? '');
    const rows = this.data
      .filter((i) => !f.track || (i.track === f.track && !CLOSED_REQUEST.has(i.requestStatus)))
      .filter((i) => !f.subjectKey || key(i) === f.subjectKey)
      .filter((i) => !q || fold(`${i.studentName} ${i.requestNumber}`).includes(q))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return this.wait(rows);
  }

  item(id: string): Promise<TeacherItemDetail> {
    const i = this.data.find((x) => x.id === id);
    if (!i) return Promise.reject(new Error('No encontramos esa solicitud entre las de tus materias.'));
    const history: TeacherItemDetail['history'] = [{ at: i.submittedAt, title: 'Solicitud enviada por el estudiante', who: i.studentName, note: null }];
    if (i.track !== 'por_atender') history.push({ at: iso(1), title: TRACK_LABELS[i.track], who: 'Docente de ejemplo', note: i.note });
    return this.wait({ ...i, campus: 'YANUNCAY', representativeName: 'Representante de ejemplo', doneAt: null, updatedBy: null,
      coTeachers: [], studentNotice: i.track === 'programada' ? { sentAt: iso(1), read: false, readAt: null, mailStatus: 'enviado' } : null, history });
  }

  pdf(_id: string): Promise<Blob> {
    return Promise.reject(new Error('En la vista previa no hay PDF: los datos son de ejemplo.'));
  }

  updateTrack(ids: string[], u: TrackUpdate): Promise<TeacherItem[]> {
    const set = new Set(ids);
    this.data = this.data.map((i) => (set.has(i.id) && !CLOSED_REQUEST.has(i.requestStatus)
      ? { ...i, track: u.track, scheduledAt: u.track === 'programada' ? (u.scheduledAt ?? null) : null, note: u.note ?? i.note, isNew: false }
      : i));
    return this.wait(this.data.filter((i) => set.has(i.id)));
  }

  notifications(): Promise<TeacherNotification[]> {
    return this.wait(this.notes);
  }

  markRead(ids: string[] | 'all'): Promise<void> {
    const set = ids === 'all' ? null : new Set(ids);
    this.notes = this.notes.map((n) => (!set || set.has(n.id) ? { ...n, read: true } : n));
    this.unread.set(this.notes.filter((n) => !n.read).length);
    return this.wait(undefined);
  }
}

/** Implementación real: el servidor solo devuelve las materias, cursos y paralelos asignados al docente. */
@Injectable()
export class HttpTeacherApi extends TeacherApi {
  private readonly http = inject(HttpClient);
  private readonly b = `${API_URL}/teacher`;
  readonly isDemo = false;
  readonly unread = signal(0);

  private get<T>(path: string) { return firstValueFrom(this.http.get<T>(this.b + path)); }
  private post<T>(path: string, body: unknown) { return firstValueFrom(this.http.post<T>(this.b + path, body)); }

  profile() { return this.get<TeacherProfile>('/me'); }
  subjects() { return this.get<TeacherSubject[]>('/subjects'); }

  async items(f: TeacherItemFilters = {}): Promise<TeacherItem[]> {
    const q = fold(f.search?.trim() ?? '');
    const rows = await this.get<TeacherItem[]>('/items');
    return rows.filter((i) => (!f.track || (i.track === f.track && !CLOSED_REQUEST.has(i.requestStatus)))
      && (!f.subjectKey || key(i) === f.subjectKey) && (!q || fold(`${i.studentName} ${i.requestNumber}`).includes(q)));
  }

  item(id: string) { return this.get<TeacherItemDetail>(`/items/${encodeURIComponent(id)}`); }
  pdf(id: string) { return firstValueFrom(this.http.get(`${this.b}/items/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' })); }

  updateTrack(ids: string[], u: TrackUpdate) {
    return this.post<TeacherItem[]>('/items/track', { ids, track: u.track, scheduledAt: u.scheduledAt ?? null, note: u.note ?? null, missed: !!u.missed });
  }

  async notifications(): Promise<TeacherNotification[]> {
    const list = await this.get<TeacherNotification[]>('/notifications');
    this.unread.set(list.filter((n) => !n.read).length);
    return list;
  }

  async markRead(ids: string[] | 'all'): Promise<void> {
    await this.post('/notifications/read', { ids });
    if (ids === 'all') this.unread.set(0);
    else this.unread.update((n) => Math.max(0, n - ids.length));
  }
}
