/**
 * Contrato del panel docente. Hoy lo cumple `DemoTeacherApi` (datos de ejemplo); cuando existan las cuentas
 * de docentes y sus materias, una implementación HTTP lo cumplirá con los mismos tipos.
 *
 * Una solicitud con varias materias genera un "ítem" por materia: cada docente ve solo el de su materia,
 * curso y paralelo.
 */

/** Seguimiento del docente (independiente del estado administrativo de la solicitud). */
export type TrackStatus = 'por_atender' | 'programada' | 'evaluado' | 'no_asistio';
export const TRACK_ORDER: TrackStatus[] = ['por_atender', 'programada', 'evaluado', 'no_asistio'];
export const TRACK_LABELS: Record<TrackStatus, string> = {
  por_atender: 'Por atender', programada: 'Evaluación programada', evaluado: 'Evaluado', no_asistio: 'No se presentó',
};

/** Estados administrativos que ya no requieren evaluación. */
export const CLOSED_REQUEST = new Set(['rechazado', 'cancelado']);

export interface TeacherProfile {
  name: string;
  email: string;
  /** Último ingreso anterior al actual: lo enviado después se marca como "Nuevo". */
  lastVisitAt: string | null;
}

/** Una materia asignada (curso + paralelo + materia), tal como viene del distributivo. */
export interface TeacherSubject {
  key: string;
  subject: string;
  course: string;
  paralelo: string;
  specialty: string | null;
  total: number;
  porAtender: number;
  nuevas: number;
}

export interface TeacherItem {
  id: string;
  requestId: string;
  requestNumber: string;
  studentName: string;
  course: string;
  paralelo: string;
  specialty: string | null;
  subject: string;
  /** Estado administrativo de la solicitud (pendiente, en revisión, aprobado, rechazado, cancelado). */
  requestStatus: string;
  submittedAt: string;
  track: TrackStatus;
  /** Fecha y hora de la evaluación (hora de Ecuador, "AAAA-MM-DDTHH:MM"), si está programada. */
  scheduledAt: string | null;
  note: string | null;
  isNew: boolean;
}

/** Una solicitud abierta por el docente: su materia, datos mínimos y el historial de su seguimiento. */
export interface TeacherItemDetail extends TeacherItem {
  campus: string | null;
  representativeName: string | null;
  doneAt: string | null;
  updatedBy: string | null;
  /** Otros docentes con la misma materia en ese curso y paralelo (módulos técnicos). */
  coTeachers: string[];
  /** Aviso de la evaluación programada al estudiante (y si lo leyó). */
  studentNotice: { sentAt: string; read: boolean; readAt: string | null; mailStatus: string | null } | null;
  history: { at: string; title: string; who: string | null; note: string | null }[];
}

export type NotificationKind = 'nueva' | 'cancelada' | 'rechazada' | 'recordatorio';

export interface TeacherNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Ítem relacionado, para abrirlo desde la notificación. */
  itemId: string | null;
}

export interface TeacherItemFilters {
  track?: TrackStatus | '';
  subjectKey?: string;
  search?: string;
}

export interface TrackUpdate {
  track: TrackStatus;
  /** No se presentó y se reprograma con una nueva fecha. */
  missed?: boolean;
  scheduledAt?: string | null;
  note?: string | null;
}
