import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { teacherGuard } from '../../core/guards/admin.guard';
import { DemoTeacherApi, HttpTeacherApi, TeacherApi } from './teacher-api';
import { TeacherShell } from './teacher-shell';

const t = (s: string) => `${s} · Panel docente UETS`;

export const TEACHER_ROUTES: Routes = [
  {
    path: '',
    component: TeacherShell,
    canActivate: [teacherGuard],
    // Quien tiene el rol de docente (aunque sea adicional) ve sus datos reales; el resto del personal, una vista previa.
    providers: [DemoTeacherApi, HttpTeacherApi, {
      provide: TeacherApi,
      useFactory: () => (inject(SessionService).hasRole('TEACHER') ? inject(HttpTeacherApi) : inject(DemoTeacherApi)),
    }],
    children: [
      { path: '', title: t('Inicio'), loadComponent: () => import('./pages/teacher-home-page').then((m) => m.TeacherHomePage) },
      { path: 'solicitudes', title: t('Solicitudes'), loadComponent: () => import('./pages/teacher-requests-page').then((m) => m.TeacherRequestsPage) },
      { path: 'solicitudes/:id', title: t('Solicitud'), loadComponent: () => import('./pages/teacher-request-page').then((m) => m.TeacherRequestPage) },
      { path: 'notificaciones', title: t('Notificaciones'), loadComponent: () => import('./pages/teacher-notifications-page').then((m) => m.TeacherNotificationsPage) },
      { path: '**', redirectTo: '' },
    ],
  },
];
