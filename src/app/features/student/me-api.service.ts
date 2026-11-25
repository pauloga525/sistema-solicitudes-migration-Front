import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../core/config';

export interface Profile { names: string; firstNames: string | null; lastNames: string | null; cedula: string; course: string; paralelo: string; specialty: string | null; padronMatch: boolean; completed: boolean; }
export interface Rep { id: string; linkId: string; names: string; firstNames: string | null; lastNames: string | null; cedula: string; phone: string; email: string | null; relationship: string; isPrimary: boolean; }
export interface Locks { student: boolean; representative: boolean; }
export interface Evaluation { subject: string; track: 'por_atender' | 'programada' | 'evaluado' | 'no_asistio'; scheduledAt: string | null; teacher: string | null;
  note?: string | null; missedCount?: number; }
export interface MyRequest { _id: string; requestNumber: string; status: string; course: string; paralelo: string; payload: { subjects?: string[] }; rejectionReason?: string; dueAt?: string | null; createdAt: string; evaluations?: Evaluation[]; }
export interface StudentNotice { id: string; kind: string; title: string; body: string; createdAt: string; read: boolean; requestId: string | null; subject: string | null; }

@Injectable({ providedIn: 'root' })
export class MeApi {
  private readonly http = inject(HttpClient);
  private readonly b = `${API_URL}/me`;
  profile() { return firstValueFrom(this.http.get<{ email: string; profile: Profile | null; representatives: Rep[]; relationships: string[]; locks: Locks }>(`${this.b}/profile`)); }
  saveProfile(p: Partial<Profile>) { return firstValueFrom(this.http.put<{ profile: Profile; representatives: Rep[]; locks: Locks }>(`${this.b}/profile`, p)); }
  addRep(r: Record<string, unknown>) { return firstValueFrom(this.http.post<{ representatives: Rep[]; completed: boolean; locks: Locks }>(`${this.b}/representatives`, r)); }
  updateRep(id: string, r: Record<string, unknown>) { return firstValueFrom(this.http.put<{ representatives: Rep[]; note: string | null; locks: Locks }>(`${this.b}/representatives/${id}`, r)); }
  removeRep(id: string) { return firstValueFrom(this.http.delete<{ representatives: Rep[]; completed: boolean }>(`${this.b}/representatives/${id}`)); }
  requests() { return firstValueFrom(this.http.get<{ data: MyRequest[] }>(`${this.b}/requests`)); }
  /** Materias que cursa el estudiante (según curso/paralelo) y habilitadas para el trámite. */
  subjects(requestType = 'proceso_mejora') { return firstValueFrom(this.http.get<{ course: string; specialty: string | null; subjects: string[]; usedThisTrimester?: string[]; trimester?: string | null }>(`${this.b}/subjects`, { params: { requestType } })); }
  quota() { return firstValueFrom(this.http.get<{ aporte: { name: string; trimestre: string; anio: string; endDate: string } | null; limite: number; consumido: number; disponible: number }>(`${this.b}/requests/quota`)); }
  /** Avisos del sistema (p. ej. el docente programó la evaluación). */
  notifications() { return firstValueFrom(this.http.get<StudentNotice[]>(`${this.b}/notifications`)); }
  readNotifications(ids: string[] | 'all') { return firstValueFrom(this.http.post<{ updated: number }>(`${this.b}/notifications/read`, { ids })); }
  cancel(id: string) { return firstValueFrom(this.http.post<MyRequest>(`${this.b}/requests/${id}/cancel`, {})); }
  pdf(id: string) { return firstValueFrom(this.http.get(`${this.b}/requests/${id}/pdf`, { responseType: 'blob' })); }
}
