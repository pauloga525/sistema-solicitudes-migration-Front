import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';
import { AdminShell } from './shell/admin-shell';

/** Panel administrativo: todo detrás del guard + temporizador de inactividad (AdminShell). */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShell,
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    children: [
      { path: 'dashboard', title: 'Solicitudes · Panel UETS', loadComponent: () => import('./solicitudes/solicitudes-page').then((m) => m.SolicitudesPage) },
      { path: 'solicitudes/:id', title: 'Detalle de solicitud · Panel UETS', loadComponent: () => import('./detalle/detalle-page').then((m) => m.DetallePage) },
      { path: 'editor', title: 'Editor de solicitudes · Panel UETS', loadComponent: () => import('./editor/editor-page').then((m) => m.EditorPage) },
      { path: 'editor/:requestType', title: 'Editor · Panel UETS', loadComponent: () => import('./editor/editor-detalle-page').then((m) => m.EditorDetallePage) },
      { path: 'activacion', title: 'Activación del sistema · Panel UETS', loadComponent: () => import('./activacion/activacion-page').then((m) => m.ActivacionPage) },
      { path: 'plazos', title: 'Plazos académicos · Panel UETS', loadComponent: () => import('./plazos/plazos-page').then((m) => m.PlazosPage) },
      { path: 'padron', title: 'Padrón · Panel UETS', loadComponent: () => import('./padron/padron-page').then((m) => m.PadronPage) },
      { path: '**', redirectTo: '/admin/dashboard' },
    ],
  },
];
