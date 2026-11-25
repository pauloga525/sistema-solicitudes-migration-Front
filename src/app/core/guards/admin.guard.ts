import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Role, SessionService } from '../auth/session.service';
import { MeApi } from '../../features/student/me-api.service';
import { campusGroupForCourse } from '../catalogs';

/**
 * Guardas de navegación. Solo deciden qué pantalla mostrar: la autorización real la hace el servidor
 * en cada endpoint.
 */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const session = inject(SessionService);
    const router = inject(Router);
    const u = session.user();
    if (!u) return router.createUrlTree(['/ingresar'], { queryParams: { next: state.url } });
    if (u.forcePasswordChange) return router.createUrlTree(['/cambiar-contrasena']);
    if (!roles.includes(u.role)) return router.createUrlTree([u.home]);
    return true;
  };
}

export const adminGuard = roleGuard('ADMIN', 'SUPERADMIN');
export const superadminGuard = roleGuard('SUPERADMIN');
export const studentGuard = roleGuard('STUDENT');
/** Panel docente. ADMIN y SUPERADMIN entran en modo vista previa (datos de ejemplo) hasta cargar los docentes. */
export const teacherGuard = roleGuard('TEACHER', 'ADMIN', 'SUPERADMIN');

/** Pantallas de solicitud: además del rol, el estudiante debe tener sus datos completos. */
export const studentReadyGuard: CanActivateFn = (route, state) => {
  const base = studentGuard(route, state);
  if (base !== true) return base;
  const u = inject(SessionService).user();
  return u?.profileCompleted ? true : inject(Router).createUrlTree(['/estudiante/perfil'], { queryParams: { completar: 1 } });
};

/** Ingreso y registro: con sesión abierta se va directo al inicio del rol. */
export const loginGuard: CanActivateFn = () => {
  const u = inject(SessionService).user();
  if (!u) return true;
  return inject(Router).createUrlTree([u.forcePasswordChange ? '/cambiar-contrasena' : u.home]);
};

/**
 * El estudiante no elige campus: sale de su curso. `/solicitud` salta directo a los trámites de su campus
 * y `/solicitud/tramites` corrige un `?campus=` que no le corresponde.
 */
export const studentCampusGuard: CanActivateFn = async (route, state) => {
  // Las inyecciones van antes del primer await (después ya no hay contexto de inyección).
  const router = inject(Router);
  const me = inject(MeApi);
  const base = studentReadyGuard(route, state);
  if (base !== true) return base as boolean | UrlTree;
  try {
    const course = (await me.profile()).profile?.course;
    if (!course) return router.createUrlTree(['/estudiante/perfil'], { queryParams: { completar: 1 } });
    const campus = campusGroupForCourse(course);
    const onList = state.url.startsWith('/solicitud/tramites');
    if (onList && route.queryParamMap.get('campus') === campus) return true;
    return router.createUrlTree(['/solicitud/tramites'], { queryParams: { campus } });
  } catch {
    return router.createUrlTree(['/estudiante']);
  }
};
