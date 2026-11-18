# Sistema de Solicitudes UETS — Frontend (Angular)

Angular 22 (componentes standalone, signals, Reactive Forms, lazy loading). Incluye el sitio público, el área del estudiante, el panel del administrador y el panel SUPERADMIN.

Backend: repositorio `sistema-solicitudes-migration-Back-end` (FastAPI + MongoDB).

## Desarrollo

```bash
npm install
npm start          # http://localhost:5173 — el proxy (proxy.conf.json) envía /api al backend en :3001
npm test           # pruebas unitarias (Vitest)
npm run build      # dist/frontend/browser
npm run e2e        # recorrido completo en navegador (Playwright); requiere backend y una base de PRUEBAS
```

La URL del backend se configura en `public/env.js` (por defecto `/api`, mismo origen). En producción se edita `dist/frontend/browser/env.js` sin recompilar.

## Sesión y seguridad
- La sesión es una cookie HttpOnly que emite el backend; el frontend nunca maneja el token.
- Toda escritura envía la cabecera `X-CSRF-Token` (interceptor `core/interceptors/auth.interceptor.ts`).
- Las guardas (`core/guards`) solo deciden qué pantalla mostrar: la autorización real está en el servidor.
- Ingreso con Google (cuenta institucional): se activa solo si el backend tiene `GOOGLE_CLIENT_ID`. Agrega el origen del frontend en *Orígenes de JavaScript autorizados* del cliente OAuth.

## Estructura

```
src/app/
├── core/          configuración, catálogos (cursos, paralelos, especialidades), sesión, guardas, interceptor, servicios
├── shared/ui/     marco de paneles, notificaciones, confirmaciones, paginación, estados vacíos y de carga
└── features/
    ├── public/      landing y trámite (campus según el curso, formulario, vista previa)
    ├── auth/        ingresar, registro, cambio de contraseña, mantenimiento, botón de Google
    ├── student/     mis solicitudes y registro de datos (estudiante y representante)
    ├── admin/       bandeja, detalle, cursos y materias, calendario académico, padrón
    └── superadmin/  resumen, usuarios, fichas, solicitudes, plazos y límites, auditoría, errores, configuración
```

Íconos: subconjunto de Material Symbols en `public/fonts`. Si agrega un ícono, ejecute `npm run icons` (requiere `pip install fonttools brotli`).
