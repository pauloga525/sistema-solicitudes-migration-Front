import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavGroup, PanelFrame } from '../../shared/ui/panel-frame';

const GROUPS: NavGroup[] = [
  { label: null, items: [{ to: '/superadmin/dashboard', label: 'Resumen', icon: 'monitoring' }] },
  { label: 'Personas', items: [
    { to: '/superadmin/usuarios', label: 'Usuarios', icon: 'manage_accounts' },
    { to: '/superadmin/accesos', label: 'Solicitudes de acceso', icon: 'person_add' },
    { to: '/superadmin/estudiantes', label: 'Estudiantes', icon: 'school' },
    { to: '/superadmin/representantes', label: 'Representantes', icon: 'family_restroom' },
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
  template: `<app-panel-frame [groups]="groups" subtitle="Super administración" home="/superadmin/dashboard"><router-outlet /></app-panel-frame>`,
})
export class SaShell {
  readonly groups = GROUPS;
}
