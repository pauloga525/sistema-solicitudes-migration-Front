import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { API_URL } from '../config';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Todas las llamadas al backend: envía la cookie de sesión y, en escrituras, el token CSRF
 * (patrón de doble envío). Centraliza las respuestas que cambian de pantalla: sesión vencida,
 * cambio de contraseña obligatorio y modo mantenimiento.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);
  const session = inject(SessionService);
  const router = inject(Router);
  let headers = req.headers;
  const csrf = readCookie('uets_csrf');
  if (UNSAFE.has(req.method) && csrf) headers = headers.set('X-CSRF-Token', csrf);
  const isAuthCall = req.url.startsWith(`${API_URL}/auth/`);
  return next(req.clone({ headers, withCredentials: true })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const code = (err.error as { code?: string } | null)?.code;
        if (err.status === 401 && !isAuthCall && session.user()) session.forceLogout('expired');
        else if (err.status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') void router.navigate(['/cambiar-contrasena']);
        else if (err.status === 503 && code === 'MAINTENANCE') {
          session.maintenance.set({ enabled: true, message: session.maintenance().message });
          void router.navigate(['/mantenimiento']);
        }
      }
      return throwError(() => err);
    }),
  );
};
