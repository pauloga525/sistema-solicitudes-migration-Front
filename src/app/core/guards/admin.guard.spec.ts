import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { SessionService, SessionUser } from '../auth/session.service';
import { adminGuard, studentReadyGuard, superadminGuard } from './admin.guard';

const u = (role: SessionUser['role'], extra: Partial<SessionUser> = {}): SessionUser =>
  ({ id: '1', role, email: 'x@uets.edu.ec', username: null, name: null, forcePasswordChange: false, home: `/${role}`, ...extra });

describe('guardas de rol (solo navegación; el servidor autoriza)', () => {
  let session: SessionService;
  const run = (g: typeof adminGuard) =>
    TestBed.runInInjectionContext(() => g({} as ActivatedRouteSnapshot, { url: '/x' } as RouterStateSnapshot));
  const url = (r: unknown) => (r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    session = TestBed.inject(SessionService);
  });

  it('sin sesión manda a ingresar; un rol inferior vuelve a su inicio', () => {
    expect(url(run(superadminGuard))).toBe('/ingresar?next=%2Fx');
    session.user.set(u('ADMIN'));
    expect(url(run(superadminGuard))).toBe('/ADMIN');
    expect(run(adminGuard)).toBe(true);
    session.user.set(u('STUDENT'));
    expect(url(run(adminGuard))).toBe('/STUDENT');
  });

  it('contraseña temporal obliga a cambiarla; el estudiante sin datos completa su perfil', () => {
    session.user.set(u('SUPERADMIN', { forcePasswordChange: true }));
    expect(url(run(superadminGuard))).toBe('/cambiar-contrasena');
    session.user.set(u('STUDENT', { profileCompleted: false }));
    expect(url(run(studentReadyGuard))).toBe('/estudiante/perfil?completar=1');
  });
});
