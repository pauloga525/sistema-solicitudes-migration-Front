import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/config';

const B = `${API_URL}/superadmin`;
export interface Page<T> { rows: T[]; total: number; page: number; pageSize: number; totalPages: number; }
export type Dict = Record<string, unknown>;
export type TeacherMatch = 'exacto' | 'coincidencia' | 'aproximado' | 'ambiguo' | 'sin_correo' | 'anterior';
export interface TeacherPreviewRow { nameKey: string; name: string; email: string | null; match: TeacherMatch; candidates: string[]; materias: number; }
export interface TeacherPreview { draftId: string; summary: Record<string, number>; teachers: TeacherPreviewRow[]; }
export interface TeacherRow { id: string; name: string; email: string | null; active: boolean; materias: number; hasAccount: boolean; manual?: boolean; lastLoginAt: string | null; }
export interface TeacherAssignment { course: string; paralelo: string; subject: string; specialty?: string | null; manual?: boolean; }
export interface TeacherDetail { id: string; name: string; email: string | null; active: boolean; hasAccount: boolean; manual: boolean;
  account: { id: string; role: string; isActive: boolean; lastLoginAt: string | null } | null;
  assignments: TeacherAssignment[]; }
export interface TeacherCatalog { course: string; paralelos: { code: string; specialty: string | null; subjects: string[] }[]; }
export interface MailStatus {
  config: { enabled: boolean; host: string | null; port: number; user: string | null; passwordSet: boolean; from: string | null;
    fromName: string; replyTo: string | null; mode: 'SSL' | 'STARTTLS' };
  counts: Record<string, number>;
}
export interface AccessRequest {
  id: string; email: string; name: string | null; status: 'pending' | 'granted' | 'dismissed'; attempts: number;
  firstSeenAt: string; lastSeenAt: string; grantedRole: string | null; resolvedAt: string | null;
}

function params(q: Record<string, unknown> = {}): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  return p;
}

export interface UserRow {
  id: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPERADMIN'; roleLabel: string; email: string | null; username: string | null; name: string | null;
  isActive: boolean; forcePasswordChange: boolean; tempPasswordExpiresAt: string | null; lastLoginAt: string | null; createdAt: string; legacy: boolean;
  cedula?: string | null; profileCompleted?: boolean; google?: boolean; hasPassword?: boolean;
}
export interface ReqRow {
  evaluations?: { subject: string; track: string; label: string; scheduledAt: string | null; missedCount?: number }[];
  id: string; requestNumber: string; requestType: string; status: string; studentName: string; studentDni: string; representativeName: string;
  course: string; paralelo: string; campus: string; subjects: string[]; createdAt: string; dueAt: string | null; overdue: boolean;
  assignedTo: string | null; assignedName: string | null; legacy: boolean;
}
export interface HistoryEvent {
  id: string; eventType: string; eventLabel: string; fromStatus: string | null; toStatus: string | null; actorName: string | null;
  actorRole: string | null; actorRoleLabel: string | null; actorIp: string | null; comment: string | null; createdAt: string;
}
export interface Period { key: string; anio: string; trimestre: string; aporte: string; startDate: string; endDate: string; isCurrent: boolean; }

/** Cliente del panel SUPERADMIN. Cada ruta la autoriza el servidor (rol exacto). */
@Injectable({ providedIn: 'root' })
export class SaApi {
  private readonly http = inject(HttpClient);
  private get<T>(path: string, q?: Record<string, unknown>) { return firstValueFrom(this.http.get<T>(`${B}${path}`, { params: params(q) })); }
  private post<T>(path: string, body: unknown = {}) { return firstValueFrom(this.http.post<T>(`${B}${path}`, body)); }
  private put<T>(path: string, body: unknown) { return firstValueFrom(this.http.put<T>(`${B}${path}`, body)); }
  private patch<T>(path: string, body: unknown) { return firstValueFrom(this.http.patch<T>(`${B}${path}`, body)); }

  dashboard() { return this.get<Dict>('/dashboard'); }

  users(q: Dict) { return this.get<Page<UserRow>>('/users', q); }
  /** Vista previa de la importación: el distributivo (solo hoja BD2) y la exportación de correos de Google. */
  teacherPreview(distributivo: File, correos: File) {
    const fd = new FormData();
    fd.append('distributivo', distributivo);
    fd.append('correos', correos);
    return this.post<TeacherPreview>('/teachers/import/preview', fd);
  }
  teacherConfirm(draftId: string, emails: Record<string, string>, exclude: string[]) {
    return this.post<Dict>('/teachers/import/confirm', { draftId, emails, exclude });
  }
  teachers(q: Dict) { return this.get<Page<TeacherRow> & { totals: { activos: number; sinCorreo: number }; lastImport: { at: string; summary: Dict } | null }>('/teachers', q); }
  teacher(id: string) { return this.get<TeacherDetail>(`/teachers/${id}`); }
  setTestAccount(studentId: string, enabled: boolean) { return this.post<{ testAccount: boolean }>(`/students/${studentId}/test-account`, { enabled }); }
  teacherCatalog() { return this.get<TeacherCatalog[]>('/teachers/catalog'); }
  addAssignment(id: string, a: TeacherAssignment) { return this.post<TeacherDetail>(`/teachers/${id}/assignments`, { course: a.course, paralelo: a.paralelo, subject: a.subject }); }
  removeAssignment(id: string, a: TeacherAssignment) { return this.post<TeacherDetail>(`/teachers/${id}/assignments/remove`, { course: a.course, paralelo: a.paralelo, subject: a.subject }); }
  setTeacherEmail(id: string, email: string) { return this.patch<{ ok: boolean; account: string }>(`/teachers/${id}/email`, { email }); }
  accessRequests(q: Dict) { return this.get<Page<AccessRequest> & { pending: number }>('/access-requests', q); }
  grantAccess(id: string, role: 'ADMIN' | 'SUPERADMIN', reason: string) { return this.post<{ userId: string }>(`/access-requests/${id}/grant`, { role, reason }); }
  dismissAccess(id: string, reason: string | null) { return this.post<{ ok: boolean }>(`/access-requests/${id}/dismiss`, { reason }); }
  user(id: string) { return this.get<UserRow>(`/users/${id}`); }
  createUser(b: Dict) { return this.post<{ user: UserRow; tempPassword: string | null; expiresAt: string | null }>('/users', b); }
  updateUser(id: string, b: Dict) { return this.patch<UserRow>(`/users/${id}`, b); }
  changeRole(id: string, role: string, reason: string) { return this.post<UserRow>(`/users/${id}/role`, { role, reason }); }
  deactivate(id: string, reason: string) { return this.post<UserRow>(`/users/${id}/deactivate`, { reason }); }
  /** Eliminación permanente (motivo y correo de la cuenta como confirmación). */
  deleteUser(id: string, reason: string, confirm: string) { return this.post<{ deleted: boolean }>(`/users/${id}/delete`, { reason, confirm }); }
  reactivate(id: string) { return this.post<UserRow>(`/users/${id}/reactivate`); }
  resetPassword(id: string) { return this.post<{ tempPassword: string; expiresAt: string }>(`/users/${id}/reset-password`); }
  access(id: string, page = 1) { return this.get<Page<Dict>>(`/users/${id}/access`, { page }); }

  students(q: Dict) { return this.get<Page<Dict>>('/students', q); }
  student(id: string) { return this.get<Dict>(`/students/${id}`); }
  unlockStudent(id: string, reason: string, scope: string) { return this.post<Dict>(`/students/${id}/unlock`, { reason, scope }); }
  lockStudent(id: string) { return this.post<Dict>(`/students/${id}/lock`); }
  reps(q: Dict) { return this.get<Page<Dict>>('/representatives', q); }
  rep(id: string) { return this.get<Dict>(`/representatives/${id}`); }
  editRep(id: string, b: Dict) { return this.patch<Dict>(`/representatives/${id}`, b); }
  link(b: Dict) { return this.post<{ representatives: Dict[] }>('/links', b); }
  setPrimary(linkId: string) { return this.post<{ representatives: Dict[] }>(`/links/${linkId}/primary`); }
  unlink(linkId: string, reason: string) { return this.post<{ representatives: Dict[] }>(`/links/${linkId}/unlink`, { reason }); }
  inconsistencies() { return this.get<Dict>('/inconsistencies'); }

  requests(q: Dict) { return this.get<Page<ReqRow> & { byStatus: Record<string, number> }>('/requests', q); }
  request(id: string) { return this.get<{ request: Dict & ReqRow; history: HistoryEvent[]; allowedCorrections: string[] }>(`/requests/${id}`); }
  staff() { return this.get<{ id: string; name: string; role: string }[]>('/requests/staff'); }
  deleteRequest(id: string, reason: string, confirm: string) { return this.post<{ deleted: boolean }>(`/requests/${id}/delete`, { reason, confirm }); }
  correct(id: string, expectedStatus: string, status: string, reason: string) {
    return this.post<Dict>(`/requests/${id}/correct-status`, { expectedStatus, status, reason });
  }
  assign(id: string, userId: string | null) { return this.post<Dict>(`/requests/${id}/assign`, { userId }); }
  setDue(id: string, dueAt: string | null, reason?: string) { return this.post<Dict>(`/requests/${id}/due`, { dueAt, reason }); }
  bulkDue(b: Dict) { return this.post<{ updated: number }>('/requests/due-bulk', b); }
  exportRequests(q: Dict) { return firstValueFrom(this.http.get(`${B}/requests/export`, { params: params(q), responseType: 'blob' })); }
  requestPdf(id: string) { return firstValueFrom(this.http.get(`${B}/requests/${id}/pdf`, { responseType: 'blob' })); }

  periods() { return this.get<Period[]>('/periods'); }
  deadlines() { return this.get<Dict[]>('/deadlines'); }
  putDeadline(b: Dict) { return this.put<Dict[]>('/deadlines', b); }
  bulkDeadlines(b: Dict) { return this.post<Dict[]>('/deadlines/bulk', b); }
  toggleDeadline(id: string) { return this.post<Dict[]>(`/deadlines/${id}/toggle`); }
  limits() { return this.get<Dict>('/limits'); }
  putLimit(b: Dict) { return this.put<Dict>('/limits', b); }
  previewLimit(b: Dict) { return this.post<Dict>('/limits/preview', b); }
  exceptions() { return this.get<Dict[]>('/limit-exceptions'); }
  grantException(b: Dict) { return this.post<Dict[]>('/limit-exceptions', b); }
  revokeException(id: string, reason: string) { return this.post<Dict[]>(`/limit-exceptions/${id}/revoke`, { reason }); }

  requestEvents(q: Dict) { return this.get<Page<Dict>>('/audit/request-events', q); }
  userEvents(q: Dict) { return this.get<Page<Dict>>('/audit/users', q); }
  labels() { return this.get<{ request: Record<string, string>; user: Record<string, string>; roles: Record<string, string> }>('/audit/labels'); }

  errors(q: Dict) { return this.get<Page<Dict> & { stats: Dict; sources: string[] }>('/errors', q); }
  error(id: string) { return this.get<Dict>(`/errors/${id}`); }
  resolveError(id: string, note: string) { return this.post<Dict>(`/errors/${id}/resolve`, { note }); }
  reopenError(id: string) { return this.post<Dict>(`/errors/${id}/reopen`); }

  settings() { return this.get<Dict>('/settings'); }
  mailStatus() { return this.get<MailStatus>('/mail/status'); }
  mailTest(to: string) { return this.post<{ ok: boolean; error?: string; hint?: string }>('/mail/test', { to }); }
  mailRetry() { return this.post<{ retried: number }>('/mail/retry-failed', {}); }
  maintenance(enabled: boolean, message: string | null) { return this.put<Dict>('/settings/maintenance', { enabled, message }); }
  params(b: Dict) { return this.put<Dict>('/settings/params', b); }
}
