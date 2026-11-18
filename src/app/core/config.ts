declare global {
  interface Window {
    __env?: { apiUrl?: string };
  }
}

/**
 * URL del backend. Por defecto `/api` en el mismo origen (proxy de desarrollo o del servidor web):
 * así la cookie de sesión y el token CSRF viajan sin CORS de terceros.
 */
export const API_URL: string = (window.__env?.apiUrl ?? '/api').replace(/\/$/, '');
