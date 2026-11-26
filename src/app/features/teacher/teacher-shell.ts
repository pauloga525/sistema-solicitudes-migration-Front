import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { fmtAgo } from '../../shared/ui/format';
import { NavGroup, PanelFrame } from '../../shared/ui/panel-frame';
import { TeacherApi } from './teacher-api';
import { TeacherNotification } from './teacher.models';
import { notificationIcon } from './pages/teacher-format';

/** El aviso de novedades se muestra una vez por carga de la aplicación (no en cada cambio de página). */
let welcomeShown = false;

/** Marco del panel docente: riel, aviso de vista previa y aviso de novedades al ingresar. */
@Component({
  selector: 'app-teacher-shell',
  imports: [RouterOutlet, PanelFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-panel-frame [groups]="groups()" subtitle="Panel docente" home="/docente">
      @if (api.isDemo) {
        <div><p class="demo" role="note"><span class="material-symbols-outlined" aria-hidden="true">science</span>
          <span><strong>Vista previa con datos de ejemplo.</strong> Los nombres son inventados y los cambios no se guardan.
            Cuando se carguen los docentes y sus materias, cada docente verá aquí sus solicitudes reales.</span></p></div>
      }
      <router-outlet />
    </app-panel-frame>

    <dialog #welcome class="dialog news" aria-labelledby="news-title" (close)="welcomeOpen.set(false)">
      <div class="dialog-head">
        <span class="bell"><span class="material-symbols-outlined" aria-hidden="true">notifications_active</span></span>
        <h2 id="news-title" class="dtitle">Tienes {{ fresh().length }} {{ fresh().length === 1 ? 'novedad' : 'novedades' }}</h2>
      </div>
      <div class="dialog-body">
        <p class="lead">Desde tu último ingreso:</p>
        <ul class="nlist">
          @for (n of fresh().slice(0, 4); track n.id) {
            <li><span class="material-symbols-outlined" [class]="'material-symbols-outlined ic ' + n.kind" aria-hidden="true">{{ icon(n.kind) }}</span>
              <span><strong>{{ n.title }}</strong><small>{{ n.body }} · {{ ago(n.createdAt) }}</small></span></li>
          }
        </ul>
        @if (fresh().length > 4) { <p class="more">y {{ fresh().length - 4 }} más.</p> }
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" (click)="welcome.close()">Más tarde</button>
        <button type="button" class="btn btn-primary" (click)="goNews()">Ver solicitudes</button>
      </div>
    </dialog>
  `,
  styles: `
    .demo { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 10px 14px; border-radius: var(--radius-md);
      background: var(--primary-fixed); color: var(--on-primary-fixed); font: var(--body-md); }
    .demo .material-symbols-outlined { font-size: 20px; margin-top: 1px; }
    .news { width: min(480px, calc(100vw - 32px)); }
    .dtitle { font: var(--title-lg); margin: 0; }
    .nlist small { display: block; }
    .bell { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: #fff6d6; color: #5c4700; flex: none; }
    .lead { margin: 0 0 10px; color: var(--on-surface-variant); }
    .nlist { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .nlist li { display: flex; gap: 10px; align-items: flex-start; }
    .nlist strong { display: block; font: var(--label-lg); }
    .nlist small { color: var(--on-surface-variant); font-size: 0.8125rem; line-height: 1.45; }
    .ic { font-size: 20px; margin-top: 1px; color: var(--primary-container); }
    .ic.cancelada, .ic.rechazada { color: var(--on-surface-variant); }
    .more { margin: 10px 0 0; color: var(--on-surface-variant); font-size: 0.8125rem; line-height: 1.45; }
  `,
})
export class TeacherShell {
  readonly api = inject(TeacherApi);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly welcome = viewChild.required<ElementRef<HTMLDialogElement>>('welcome');
  readonly welcomeOpen = signal(false);
  readonly fresh = signal<TeacherNotification[]>([]);
  readonly ago = fmtAgo;

  readonly groups = computed<NavGroup[]>(() => {
    const base: NavGroup[] = [
      { label: null, items: [
        { to: '/docente', label: 'Inicio', icon: 'home', exact: true },
        { to: '/docente/solicitudes', label: 'Solicitudes', icon: 'assignment' },
        { to: '/docente/notificaciones', label: 'Notificaciones', icon: 'notifications', badge: this.api.unread() },
      ] },
    ];
    const sa = this.session.hasRole('SUPERADMIN');
    if (sa || this.session.hasRole('ADMIN')) {
      base.push({ label: 'Otras áreas', items: [
        { to: '/admin/dashboard', label: 'Panel del administrador', icon: 'inbox' },
        ...(sa ? [{ to: '/superadmin/dashboard', label: 'Super administración', icon: 'shield' }] : []),
      ] });
    }
    return base;
  });

  constructor() {
    this.api.notifications().then((list) => {
      const unread = list.filter((n) => !n.read);
      if (!unread.length || welcomeShown) return;
      welcomeShown = true;
      this.fresh.set(unread);
      this.welcomeOpen.set(true);
      queueMicrotask(() => this.welcome().nativeElement.showModal());
    }, () => undefined);
  }

  readonly icon = notificationIcon;

  goNews() {
    this.welcome().nativeElement.close();
    void this.router.navigate(['/docente/solicitudes'], { queryParams: { track: 'por_atender' } });
  }
}
