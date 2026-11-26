import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { RouterOutlet } from '@angular/router';
import { NavGroup, PanelFrame } from '../../shared/ui/panel-frame';

const GROUPS: NavGroup[] = [
  { label: null, items: [{ to: '/superadmin/dashboard', label: 'Resumen', icon: 'monitoring' }] },
  { label: 'Personas', items: [
    { to: '/superadmin/docentes', label: 'Docentes', icon: 'co_present' },
    { to: '/superadmin/accesos', label: 'Solicitudes de acceso', icon: 'person_add' },
    { to: '/superadmin/estudiantes', label: 'Estudiantes', icon: 'school' },
    { to: '/superadmin/representantes', label: 'Representantes', icon: 'family_restroom' },
    { to: '/superadmin/usuarios', label: 'Administradores', icon: 'manage_accounts' },
    { to: '/superadmin/inconsistencias', label: 'Inconsistencias', icon: 'rule' },
  ] },
  { label: 'Solicitudes', items: [
    { to: '/superadmin/solicitudes', label: 'Todas las solicitudes', icon: 'list_alt' },
    { to: '/superadmin/plazos', label: 'Plazos y límites', icon: 'event_busy' },
  ] },
  { label: 'Sistema', items: [
    { to: '/superadmin/auditoria', label: 'Auditoría', icon: 'history' },
    { to: '/superadmin/errores', label: 'Errores', icon: 'bug_report' },
    { to: '/superadmin/configuracion', label: 'Configuración', icon: 'settings' },
  ] },
  { label: 'Otras áreas', items: [{ to: '/admin/dashboard', label: 'Panel del administrador', icon: 'inbox' }] },
];

/** Panel SUPERADMIN dentro del marco común de los paneles. */
@Component({
  selector: 'app-sa-shell',
  imports: [RouterOutlet, PanelFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-panel-frame [groups]="groups()" subtitle="Super administración" home="/superadmin/dashboard"><router-outlet /></app-panel-frame>`,
})
export class SaShell {
  private readonly session = inject(SessionService);
  /** Un SUPERADMIN que también es docente ve el acceso a su panel docente. */
  readonly groups = computed<NavGroup[]>(() => this.session.hasRole('TEACHER')
    ? GROUPS.map((g) => (g.label === 'Otras áreas' ? { ...g, items: [...g.items, { to: '/docente', label: 'Panel docente', icon: 'co_present' }] } : g))
    : GROUPS);
}
