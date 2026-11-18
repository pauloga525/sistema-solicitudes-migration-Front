import { Routes } from '@angular/router';
import { superadminGuard } from '../../core/guards/admin.guard';
import { SaShell } from './sa-shell';

const t = (s: string) => `${s} · Super administración UETS`;

/** Panel SUPERADMIN. La guarda solo decide la navegación: cada endpoint exige el rol en el servidor. */
export const SUPERADMIN_ROUTES: Routes = [
  {
    path: '',
    component: SaShell,
    canActivate: [superadminGuard],
    canActivateChild: [superadminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: t('Resumen'), loadComponent: () => import('./pages/dashboard-page').then((m) => m.DashboardPage) },
      { path: 'accesos', title: t('Solicitudes de acceso'), loadComponent: () => import('./pages/access-page').then((m) => m.AccessPage) },
      { path: 'usuarios', title: t('Usuarios'), loadComponent: () => import('./pages/users-page').then((m) => m.UsersPage) },
      { path: 'estudiantes', title: t('Estudiantes'), loadComponent: () => import('./pages/students-page').then((m) => m.StudentsPage) },
      { path: 'estudiantes/:id', title: t('Ficha del estudiante'), loadComponent: () => import('./pages/student-detail-page').then((m) => m.StudentDetailPage) },
      { path: 'representantes', title: t('Representantes'), loadComponent: () => import('./pages/reps-page').then((m) => m.RepsPage) },
      { path: 'representantes/:id', title: t('Ficha del representante'), loadComponent: () => import('./pages/rep-detail-page').then((m) => m.RepDetailPage) },
      { path: 'inconsistencias', title: t('Inconsistencias'), loadComponent: () => import('./pages/inconsistencies-page').then((m) => m.InconsistenciesPage) },
      { path: 'solicitudes', title: t('Solicitudes'), loadComponent: () => import('./pages/requests-page').then((m) => m.RequestsPage) },
      { path: 'solicitudes/:id', title: t('Detalle de solicitud'), loadComponent: () => import('./pages/request-detail-page').then((m) => m.RequestDetailPage) },
      { path: 'plazos', title: t('Plazos y límites'), loadComponent: () => import('./pages/limits-page').then((m) => m.LimitsPage) },
      { path: 'auditoria', title: t('Auditoría'), loadComponent: () => import('./pages/audit-page').then((m) => m.AuditPage) },
      { path: 'errores', title: t('Errores del sistema'), loadComponent: () => import('./pages/errors-page').then((m) => m.ErrorsPage) },
      { path: 'configuracion', title: t('Configuración'), loadComponent: () => import('./pages/settings-page').then((m) => m.SettingsPage) },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
