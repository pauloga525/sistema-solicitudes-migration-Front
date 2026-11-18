import { Routes } from '@angular/router';
import { studentGuard } from '../../core/guards/admin.guard';
import { StudentShell } from './student-shell';

export const STUDENT_ROUTES: Routes = [
  {
    path: '',
    component: StudentShell,
    canActivate: [studentGuard],
    children: [
      { path: '', title: 'Mis solicitudes · UETS', loadComponent: () => import('./my-requests-page').then((m) => m.MyRequestsPage) },
      { path: 'perfil', title: 'Mis datos · UETS', loadComponent: () => import('./profile-page').then((m) => m.ProfilePage) },
      { path: '**', redirectTo: '' },
    ],
  },
];
