import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { NavGroup, PanelFrame } from '../../../shared/ui/panel-frame';

const BASE: NavGroup[] = [
  { label: null, items: [
    { to: '/admin/dashboard', label: 'Bandeja de solicitudes', icon: 'inbox' },
    { to: '/admin/seguimiento', label: 'Seguimiento de evaluaciones', icon: 'fact_check' },
  ] },
  { label: 'Configuración del trámite', items: [
    { to: '/admin/activacion', label: 'Activación del sistema', icon: 'event_available' },
    { to: '/admin/editor', label: 'Cursos y materias', icon: 'edit_note' },
    { to: '/admin/plazos', label: 'Calendario académico', icon: 'calendar_month' },
    { to: '/admin/padron', label: 'Padrón de estudiantes', icon: 'groups' },
  ] },
];

/** Contenedor de las rutas del ADMIN: marco común (riel, mantenimiento, cierre por 5 min de inactividad). */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, PanelFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-panel-frame [groups]="groups()" subtitle="Administración" home="/admin/dashboard"><router-outlet /></app-panel-frame>`,
})
export class AdminShell {
  private readonly session = inject(SessionService);
  readonly groups = computed<NavGroup[]>(() => [...BASE, { label: 'Otras áreas', items: [
    this.session.hasRole('TEACHER')
      ? { to: '/docente', label: 'Panel docente', icon: 'co_present' }
      : { to: '/docente', label: 'Panel docente (vista previa)', icon: 'co_present' },
    ...(this.session.role() === 'SUPERADMIN' ? [{ to: '/superadmin/dashboard', label: 'Super administración', icon: 'shield' }] : []),
  ] }]);
}
