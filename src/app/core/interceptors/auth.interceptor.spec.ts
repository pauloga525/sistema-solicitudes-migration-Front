import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionService } from '../auth/session.service';
import { API_URL } from '../config';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor (cookie + CSRF)', () => {
  beforeEach(() => {
    document.cookie = 'uets_csrf=tok123; path=/';
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
  });

  it('envía credenciales y el token CSRF solo en escrituras', () => {
    const http = TestBed.inject(HttpClient);
    const ctl = TestBed.inject(HttpTestingController);
    http.get(`${API_URL}/requests`).subscribe();
    http.post(`${API_URL}/requests`, {}).subscribe();
    const g = ctl.expectOne((r) => r.method === 'GET');
    const p = ctl.expectOne((r) => r.method === 'POST');
    expect(g.request.withCredentials).toBe(true);
    expect(g.request.headers.has('X-CSRF-Token')).toBe(false);
    expect(p.request.headers.get('X-CSRF-Token')).toBe('tok123');
    expect(p.request.headers.has('Authorization')).toBe(false);
  });

  it('un 401 con sesión abierta vuelve al ingreso; un 403 de contraseña temporal lleva a cambiarla', () => {
    const http = TestBed.inject(HttpClient);
    const ctl = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionService);
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    session.user.set({ id: '1', role: 'ADMIN', email: null, username: 'admin', name: null, forcePasswordChange: false, home: '/admin/dashboard' });
    http.get(`${API_URL}/requests`).subscribe({ error: () => undefined });
    ctl.expectOne(`${API_URL}/requests`).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'x' });
    expect(session.user()).toBeNull();
    http.get(`${API_URL}/plazos`).subscribe({ error: () => undefined });
    ctl.expectOne(`${API_URL}/plazos`).flush({ code: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403, statusText: 'x' });
    expect(nav).toHaveBeenCalledWith(['/cambiar-contrasena']);
  });
});
