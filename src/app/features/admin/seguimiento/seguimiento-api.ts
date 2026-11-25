import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../../core/config';

/** Estado de una materia de una solicitud vista por la administración. */
export type EvalEstado = 'sin_docente' | 'por_atender' | 'programada' | 'vencida' | 'evaluado' | 'no_asistio' | 'no_requiere';
export type MailStatus = 'enviado' | 'pendiente' | 'fallido' | 'sin_configurar' | null;

export interface EvalRow {
  requestId: string; requestNumber: string; studentName: string; course: string; courseLabel: string; paralelo: string;
  subject: string; requestStatus: string; submittedAt: string; teachers: string[]; isTest?: boolean;
  estado: EvalEstado; estadoLabel: string; track: string; trackLabel: string; scheduledAt: string | null; doneAt: string | null;
  updatedBy: string | null; late: boolean;
  teacherNotified: boolean; teacherRead: boolean; teacherMail: MailStatus;
  studentNotified: boolean; studentRead: boolean; studentMail: MailStatus;
}

export interface EvalPage {
  rows: EvalRow[]; total: number; page: number; pageSize: number; totalPages: number;
  totals: Record<EvalEstado | 'atrasadas' | 'total', number>;
  estados: Record<EvalEstado, string>;
}

export interface EvalFilters { estado?: string; course?: string; paralelo?: string; subject?: string; teacher?: string; q?: string; page?: number }

export interface ExpTeacher { name: string; email: string | null; hasAccount: boolean | null; lastLoginAt: string | null; active: boolean }
export interface ExpSubject {
  subject: string; estado: EvalEstado; estadoLabel: string; teachers: ExpTeacher[]; snapshot: boolean;
  track: string; trackLabel: string; scheduledAt: string | null; doneAt: string | null; note: string | null;
  updatedBy: string | null; updatedAt: string | null;
}
export interface ExpEvent {
  at: string; type: 'solicitud' | 'docente' | 'aviso' | 'correo'; icon: string; title: string; detail: string | null;
  who: string | null; comment: string | null; subject: string | null;
  read?: boolean; readAt?: string | null; mailStatus?: MailStatus; mailStatusLabel?: string; mailError?: string | null; sentAt?: string | null;
}
export interface Expediente {
  requestId: string; requestNumber: string; studentName: string; course: string; courseLabel: string; paralelo: string;
  requestStatus: string; submittedAt: string; subjects: ExpSubject[]; timeline: ExpEvent[];
}

/** Seguimiento de evaluaciones (solo lectura). El servidor exige ADMIN o SUPERADMIN. */
@Injectable({ providedIn: 'root' })
export class SeguimientoApi {
  private readonly http = inject(HttpClient);
  private readonly b = `${API_URL}/evaluations`;

  private params(f: EvalFilters): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return p;
  }

  list(f: EvalFilters) { return firstValueFrom(this.http.get<EvalPage>(this.b, { params: this.params(f) })); }
  expediente(requestId: string) { return firstValueFrom(this.http.get<Expediente>(`${this.b}/request/${encodeURIComponent(requestId)}`)); }
  exportCsv(f: EvalFilters) {
    const { page: _p, ...rest } = f;
    return firstValueFrom(this.http.get(`${this.b}/export`, { params: this.params(rest), responseType: 'blob' }));
  }
}

export const MAIL_LABELS: Record<string, string> = {
  enviado: 'Correo enviado', pendiente: 'Correo en cola', fallido: 'Falló el envío del correo', sin_configurar: 'Correo no enviado (sin configurar)',
};
