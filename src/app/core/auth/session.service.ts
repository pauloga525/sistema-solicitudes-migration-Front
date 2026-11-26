import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../config';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPERADMIN';

export interface SessionUser {
  id: string;
  role: Role;
  email: string | null;
  username: string | null;
  name: string | null;
  forcePasswordChange: boolean;
  home: string;
  profileCompleted?: boolean;
}

interface SessionResponse {
  user: SessionUser | null;
  maintenance: { enabled: boolean; message: string | null };
  emailDomain: string;
  googleClientId: string | null;
  passwordRegistration: boolean;
  passwordLogin?: boolean;
  studentEmailSuffix?: string;
  /** Token CSRF vigente (para cuando el backend está en otro dominio y su cookie no se puede leer). */
  csrfToken?: string;
}

/**
 * Sesión por cookie HttpOnly (el token nunca está al alcance de JavaScript).
 * El servidor decide todo; aquí solo se guarda quién es el usuario para pintar la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<SessionUser | null>(null);
  readonly maintenance = signal<{ enabled: boolean; message: string | null }>({ enabled: false, message: null });
  readonly emailDomain = signal('uets.edu.ec');
  /** Client ID público de Google (null si el ingreso con Google no está configurado en el backend). */
  readonly googleClientId = signal<string | null>(null);
  readonly passwordRegistration = signal(true);
  /** Ingreso con usuario y contraseña (solo cuentas de prueba o de emergencia; apagado en producción). */
  readonly passwordLogin = signal(false);
  readonly studentEmailSuffix = signal('.est');
  readonly loaded = signal(false);
  /** Token CSRF recibido de /auth/session (respaldo si la cookie uets_csrf no es legible). */
  readonly csrfToken = signal<string | null>(null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly displayName = computed(() => {
    const u = this.user();
    return u?.name || u?.username || u?.email || '';
  });

  async load(): Promise<void> {
    try {
      const s = await firstValueFrom(this.http.get<SessionResponse>(`${API_URL}/auth/session`));
      this.user.set(s.user);
      this.maintenance.set(s.maintenance);
      this.emailDomain.set(s.emailDomain);
      this.googleClientId.set(s.googleClientId ?? null);
      this.passwordRegistration.set(s.passwordRegistration !== false);
      this.passwordLogin.set(s.passwordLogin === true);
      this.studentEmailSuffix.set(s.studentEmailSuffix || '.est');
      this.csrfToken.set(s.csrfToken ?? null);
    } catch {
      this.user.set(null);
    } finally {
      this.loaded.set(true);
    }
  }

  async login(username: string, password: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ user: SessionUser; redirectTo: string }>(`${API_URL}/auth/login`, { username, password }),
    );
    this.user.set(r.user);
    return r.redirectTo;
  }

  /** Ingreso con Google: el backend verifica el ID token (firma, cliente y dominio institucional). */
  async loginWithGoogle(credential: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ user: SessionUser; redirectTo: string }>(`${API_URL}/auth/google`, { credential }),
    );
    this.user.set(r.user);
    return r.redirectTo;
  }

  async register(email: string, password: string, confirmPassword: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ user: SessionUser; redirectTo: string }>(`${API_URL}/auth/register`, { email, password, confirmPassword }),
    );
    this.user.set(r.user);
    return r.redirectTo;
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/auth/change-password`, { currentPassword, newPassword, confirmPassword }));
    this.user.set(null); // el servidor cierra la sesión: se vuelve a ingresar con la contraseña nueva
  }

  markProfileCompleted(done: boolean): void {
    const u = this.user();
    if (u) this.user.set({ ...u, profileCompleted: done });
  }

  /** Cierre voluntario. */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_URL}/auth/logout`, {}));
    } catch {
      /* la cookie ya no sirve igual */
    }
    this.user.set(null);
    void this.router.navigate(['/ingresar'], { replaceUrl: true });
  }

  /** La sesión dejó de ser válida (401, inactividad): limpia el estado local y vuelve al ingreso. */
  forceLogout(reason: 'expired' | 'inactive' = 'expired'): void {
    const was = this.user();
    this.user.set(null);
    if (was) void firstValueFrom(this.http.post(`${API_URL}/auth/logout`, {})).catch(() => undefined);
    if (!this.router.url.startsWith('/ingresar')) {
      void this.router.navigate(['/ingresar'], { queryParams: { motivo: reason }, replaceUrl: true });
    }
  }
}
