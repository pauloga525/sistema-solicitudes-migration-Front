import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { TeacherApi } from '../teacher-api';
import { TeacherNotification } from '../teacher.models';
import { notificationIcon } from './teacher-format';

/** Historial de notificaciones del docente: nuevas solicitudes, cancelaciones, rechazos y recordatorios. */
@Component({
  selector: 'app-teacher-notifications',
  imports: [EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Notificaciones</h1>
      <p class="lede">Te avisamos cuando un estudiante solicita la evaluación en tus materias, cuando una solicitud se cancela o se rechaza, y antes de una evaluación programada.</p></div>
      <div class="actions">
        <button type="button" class="btn btn-outline btn-sm" (click)="readAll()" [disabled]="!unreadCount()">Marcar todas como leídas</button>
      </div></div>

    @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }

    @if (list(); as l) {
      @if (l.length) {
        @for (g of groups(); track g.label) {
          <section class="section" [attr.aria-label]="g.label">
            <header><h2>{{ g.label }}</h2></header>
            <ul class="nl">
              @for (n of g.items; track n.id) {
                <li [class.unread]="!n.read">
                  <button type="button" class="nrow" (click)="open(n)">
                    <span class="ib" [class]="'ib ' + n.kind"><span class="material-symbols-outlined" aria-hidden="true">{{ icon(n.kind) }}</span></span>
                    <span class="txt"><strong>{{ n.title }}</strong><small>{{ n.body }}</small></span>
                    <span class="when" [title]="dt(n.createdAt)">{{ ago(n.createdAt) }}</span>
                    @if (!n.read) { <span class="dot" aria-label="Sin leer"></span> }
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <div class="section"><app-empty icon="notifications_off" title="No tienes notificaciones"
          text="Cuando un estudiante solicite la evaluación de mejora en una de tus materias, te avisaremos aquí y por correo." /></div>
      }
    } @else if (!error()) { <app-skeleton-rows [rows]="5" [cols]="2" /> }
  `,
  styles: `
    .nl { list-style: none; margin: 0; padding: 4px 0; }
    .nl li + li { border-top: 1px solid var(--surface-container-high); }
    .nrow { width: 100%; display: flex; align-items: flex-start; gap: 12px; padding: 12px 18px; border: 0; background: none; text-align: left;
      font: inherit; color: inherit; cursor: pointer; }
    .nrow:hover { background: var(--surface-container-low); }
    .nrow:focus-visible { outline: 2px solid var(--primary-container); outline-offset: -2px; }
    .ib { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; flex: none; background: var(--primary-fixed); color: var(--on-primary-fixed); }
    .ib.recordatorio { background: #fff6d6; color: #5c4700; }
    .ib.cancelada, .ib.rechazada { background: var(--surface-container-high); color: var(--on-surface-variant); }
    .ib .material-symbols-outlined { font-size: 20px; }
    .txt { flex: 1; display: grid; gap: 2px; min-width: 0; }
    .txt strong { font: var(--label-lg); font-weight: 500; }
    li.unread .txt strong { font-weight: 650; }
    .txt small { color: var(--on-surface-variant); font: var(--body-md); font-size: 0.8125rem; }
    .when { font: var(--label-sm); color: var(--on-surface-variant); white-space: nowrap; margin-top: 3px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--secondary-container); outline: 2px solid #c99700; outline-offset: -1px; margin-top: 6px; flex: none; }
  `,
})
export class TeacherNotificationsPage {
  private readonly api = inject(TeacherApi);
  private readonly router = inject(Router);
  readonly list = signal<TeacherNotification[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly ago = fmtAgo;
  readonly dt = fmtDateTime;
  readonly icon = notificationIcon;
  readonly unreadCount = computed(() => (this.list() ?? []).filter((n) => !n.read).length);
  readonly groups = computed(() => {
    const l = this.list() ?? [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const week = new Date(start.getTime() - 6 * 86_400_000);
    const g = [
      { label: 'Hoy', items: l.filter((n) => new Date(n.createdAt) >= start) },
      { label: 'Esta semana', items: l.filter((n) => new Date(n.createdAt) < start && new Date(n.createdAt) >= week) },
      { label: 'Anteriores', items: l.filter((n) => new Date(n.createdAt) < week) },
    ];
    return g.filter((x) => x.items.length);
  });

  constructor() {
    this.api.notifications().then((l) => this.list.set(l), (e) => this.error.set(apiMessage(e, 'No pudimos cargar tus notificaciones.')));
  }

  async readAll() {
    await this.api.markRead('all');
    this.list.update((l) => l && l.map((n) => ({ ...n, read: true })));
  }

  async open(n: TeacherNotification) {
    if (!n.read) {
      await this.api.markRead([n.id]);
      this.list.update((l) => l && l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    // Abre la solicitud de la notificación (si sigue siendo de sus materias; si no, la lista).
    void this.router.navigate(n.itemId ? ['/docente/solicitudes', n.itemId] : ['/docente/solicitudes']);
  }
}
