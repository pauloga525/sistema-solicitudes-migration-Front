import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../config';
import {
  CourseSubjectGroup, SubmissionWindow,
  AnioLectivo, ImportSummary, Paginated, RequestFilters, SolicitudConfig, SolicitudRequest,
} from '../models/models';

/** Máximo de pageSize que acepta el backend (FilterRequestsDTO). */
export const MAX_PAGE_SIZE = 200;

/** Cliente HTTP del panel administrativo (requests, catálogo, plazos y padrón). */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  // ── solicitudes ──
  getRequests(filters: RequestFilters = {}) {
    let params = new HttpParams();
    for (const key of ['status', 'course', 'paralelo', 'subject', 'search', 'page', 'pageSize'] as const) {
      const v = filters[key];
      if (v !== undefined && v !== null && v !== '') params = params.set(key, String(v));
    }
    return firstValueFrom(this.http.get<Paginated<SolicitudRequest>>(`${API_URL}/requests`, { params }));
  }

  /** Todas las coincidencias (pagina internamente) — para exportar sin perder filas. */
  async getAllMatchingRequests(filters: RequestFilters): Promise<SolicitudRequest[]> {
    const first = await this.getRequests({ ...filters, page: 1, pageSize: MAX_PAGE_SIZE });
    const all = [...first.data];
    for (let page = 2; page <= first.totalPages; page++) {
      const next = await this.getRequests({ ...filters, page, pageSize: MAX_PAGE_SIZE });
      all.push(...next.data);
    }
    return all;
  }

  getRequestById(id: string) {
    return firstValueFrom(this.http.get<SolicitudRequest>(`${API_URL}/requests/${encodeURIComponent(id)}`));
  }

  updateRequestStatus(id: string, status: string, reason?: string) {
    return firstValueFrom(
      this.http.patch<SolicitudRequest>(`${API_URL}/requests/${encodeURIComponent(id)}/status`, reason ? { status, reason } : { status }),
    );
  }

  getRequestHistory(id: string) {
    return firstValueFrom(this.http.get<{ id: string; eventLabel: string; eventType: string; fromStatus: string | null; toStatus: string | null;
      actorName: string | null; actorRoleLabel: string | null; comment: string | null; createdAt: string }[]>(`${API_URL}/requests/${encodeURIComponent(id)}/history`));
  }

  getRequestPdf(id: string) {
    return firstValueFrom(this.http.get(`${API_URL}/requests/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' }));
  }

  // ── catálogo ──
  getConfig(requestType: string) {
    return firstValueFrom(this.http.get<SolicitudConfig>(`${API_URL}/solicitud-config/${requestType}`));
  }

  /** Materias por curso (malla) y nombres históricos, para los filtros. */
  getCurriculum(requestType: string) {
    return firstValueFrom(this.http.get<{ byCourse: Record<string, string[]>; legacy: string[] }>(
      `${API_URL}/solicitud-config/${requestType}/curriculum`));
  }

  getSubmissionWindow() {
    return firstValueFrom(this.http.get<SubmissionWindow>(`${API_URL}/system/submission-window`));
  }

  /** Ambas fechas (hora de Ecuador) o ambas null para no restringir el envío. */
  setSubmissionWindow(start: string | null, end: string | null) {
    return firstValueFrom(this.http.put<SubmissionWindow>(`${API_URL}/system/submission-window`, { start, end }));
  }

  /** Materias de cada curso (y especialidad) con su activación propia. */
  getCourseSubjects(requestType: string) {
    return firstValueFrom(this.http.get<{ groups: CourseSubjectGroup[] }>(`${API_URL}/solicitud-config/${requestType}/course-subjects`));
  }

  updateCourseSubject(requestType: string, key: string, name: string, active: number) {
    return firstValueFrom(this.http.patch<CourseSubjectGroup>(`${API_URL}/solicitud-config/${requestType}/course-subjects`, { key, name, active }));
  }

  updateConfigItem(requestType: string, kind: 'courses' | 'subjects', name: string, active: number) {
    return firstValueFrom(
      this.http.patch<SolicitudConfig>(`${API_URL}/solicitud-config/${requestType}/${kind}`, { name, active }),
    );
  }

  // ── plazos ──
  getAnios() {
    return firstValueFrom(this.http.get<AnioLectivo[]>(`${API_URL}/plazos`));
  }

  createAnio(data: AnioLectivo) {
    return firstValueFrom(this.http.post<AnioLectivo>(`${API_URL}/plazos`, data));
  }

  updateAnio(id: string, data: AnioLectivo) {
    return firstValueFrom(this.http.put<AnioLectivo>(`${API_URL}/plazos/${id}`, data));
  }

  deleteAnio(id: string) {
    return firstValueFrom(this.http.delete<AnioLectivo>(`${API_URL}/plazos/${id}`));
  }

  // ── padrón (multipart; el navegador arma el boundary) ──
  importPadron(file: File) {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<ImportSummary>(`${API_URL}/padron/import`, form));
  }
}
