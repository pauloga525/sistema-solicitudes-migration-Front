// Configuración de ejecución del frontend.
// Por defecto el backend se sirve en el mismo origen bajo /api (proxy). Si lo publica en otro dominio,
// use una URL absoluta y configure CORS_ORIGINS y COOKIE_SECURE en el backend.
window.__env = window.__env || {};
// Producción: backend en solicitudes.190-15-143-91.nip.io (rutas en la raíz, sin /api).
// En desarrollo local (npm start) se sigue usando /api a través de proxy.conf.json.
window.__env.apiUrl =
  window.__env.apiUrl ||
  (['localhost', '127.0.0.1'].includes(location.hostname)
    ? '/api'
    : 'https://solicitudes.190-15-143-91.nip.io');
