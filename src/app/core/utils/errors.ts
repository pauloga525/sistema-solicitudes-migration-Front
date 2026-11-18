import { HttpErrorResponse } from '@angular/common/http';

/** Texto del campo `message` del backend (string o lista de strings de validación). */
export function apiMessage(err: unknown, fallback = 'Error desconocido'): string {
  if (err instanceof HttpErrorResponse) {
    const m = (err.error as { message?: unknown } | null)?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string' && m) return m;
    if (err.status === 0) return 'Error de conexión. Verifique su red.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Port de getErrorMessage() del panel (listado y detalle). */
export function getErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status !== 0) {
    switch (err.status) {
      case 400:
        return `Datos inválidos: ${apiMessage(err)}`;
      case 404:
        return 'Solicitud no encontrada';
      case 409:
        // Transición no permitida o conflicto de concurrencia: el servidor explica qué pasó.
        return apiMessage(err, 'Ya existe una solicitud con estos datos');
      case 500:
        return 'Error en el servidor. Intente más tarde';
      default:
        return apiMessage(err);
    }
  }
  return 'Error de conexión. Verifique su red.';
}
