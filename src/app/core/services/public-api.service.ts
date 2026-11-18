import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../config';
import { CreateRequestPayload, CupoInfo, SolicitudConfig, SolicitudRequest, SubmissionWindow } from '../models/models';

/** Llamadas del sitio público (sin autenticación). */
@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly http = inject(HttpClient);

  /** Si hoy se pueden enviar solicitudes (fechas que define el administrador). */
  getSubmissionWindow() {
    return firstValueFrom(this.http.get<SubmissionWindow>(`${API_URL}/system/submission-window`));
  }

  getConfig(requestType: string) {
    return firstValueFrom(this.http.get<SolicitudConfig>(`${API_URL}/solicitud-config/${requestType}`));
  }

  /** true si hay un aporte activo hoy (el backend responde cuerpo vacío cuando no hay). */
  async hasActiveAporte(): Promise<boolean> {
    const body = await firstValueFrom(this.http.get(`${API_URL}/plazos/aporte-actual`, { responseType: 'text' }));
    if (!body) return false;
    try {
      return Boolean(JSON.parse(body));
    } catch {
      return false;
    }
  }

  getCupo(studentDni: string, course: string) {
    const params = new HttpParams().set('studentDni', studentDni).set('course', course);
    return firstValueFrom(this.http.get<CupoInfo>(`${API_URL}/plazos/cupo`, { params }));
  }

  previewPdf(payload: CreateRequestPayload) {
    return firstValueFrom(this.http.post(`${API_URL}/requests/preview`, payload, { responseType: 'blob' }));
  }

  createRequest(payload: CreateRequestPayload) {
    return firstValueFrom(this.http.post<SolicitudRequest>(`${API_URL}/requests`, payload));
  }

  pdfUrlWithToken(id: string, token: string): string {
    return `${API_URL}/requests/${encodeURIComponent(id)}/pdf?token=${encodeURIComponent(token)}`;
  }

  getPdfWithToken(id: string, token: string) {
    return firstValueFrom(this.http.get(this.pdfUrlWithToken(id, token), { responseType: 'blob' }));
  }
}
