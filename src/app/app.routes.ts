import { Routes } from '@angular/router';
import { loginGuard, studentCampusGuard, studentReadyGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // ── Sitio público ──
  { path: '', title: 'UETS - Sistema de Solicitudes', loadComponent: () => import('./features/public/landing/landing-page').then((m) => m.LandingPage) },

  // ── Cuentas ──
  { path: 'ingresar', title: 'Ingresar · UETS', canActivate: [loginGuard], loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage) },
  { path: 'registro', title: 'Crear cuenta · UETS', canActivate: [loginGuard], loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage) },
  { path: 'cambiar-contrasena', title: 'Cambiar contraseña · UETS', loadComponent: () => import('./features/auth/change-password-page').then((m) => m.ChangePasswordPage) },
  { path: 'mantenimiento', title: 'Sistema en mantenimiento · UETS', loadComponent: () => import('./features/auth/maintenance-page').then((m) => m.MaintenancePage) },
  { path: 'admin/login', redirectTo: 'ingresar' },

  // ── Trámite (solo estudiantes con datos completos; decisión C1). El campus sale del curso del perfil. ──
  { path: 'solicitud', title: 'Selección de campus · UETS', canActivate: [studentCampusGuard], loadComponent: () => import('./features/public/campus/campus-selection-page').then((m) => m.CampusSelectionPage) },
  { path: 'solicitud/tramites', title: 'Trámites disponibles · UETS', canActivate: [studentCampusGuard], loadComponent: () => import('./features/public/tramites/requests-list-page').then((m) => m.RequestsListPage) },
  { path: 'solicitud/formulario', title: 'Formulario de solicitud · UETS', canActivate: [studentReadyGuard], loadComponent: () => import('./features/public/form/form-page').then((m) => m.FormPage) },
  { path: 'solicitud/preview', title: 'Vista previa · UETS', canActivate: [studentReadyGuard], loadComponent: () => import('./features/public/preview/preview-page').then((m) => m.PreviewPage) },

  // ── Áreas privadas (chunks separados) ──
  { path: 'estudiante', loadChildren: () => import('./features/student/student.routes').then((m) => m.STUDENT_ROUTES) },
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/dashboard' },
  { path: 'admin', loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  { path: 'superadmin', loadChildren: () => import('./features/superadmin/superadmin.routes').then((m) => m.SUPERADMIN_ROUTES) },

  { path: '**', title: 'Página no encontrada · UETS', loadComponent: () => import('./features/public/not-found/not-found-page').then((m) => m.NotFoundPage) },
];
