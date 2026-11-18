// Configuración de ejecución del frontend.
// Por defecto el backend se sirve en el mismo origen bajo /api (proxy). Si lo publica en otro dominio,
// use una URL absoluta y configure CORS_ORIGINS y COOKIE_SECURE en el backend.
window.__env = window.__env || {};
window.__env.apiUrl = window.__env.apiUrl || '/api';
