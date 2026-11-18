import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { STATUS_LABELS, STATUS_ORDER, fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { StatusKey } from '../../../shared/ui/states';
import { SaApi } from '../sa-api.service';

type D = any; // respuesta del tablero (estructura documentada en documentation/SUPERADMIN_API.md)

@Component({
  selector: 'app-sa-dashboard',
  imports: [RouterLink, DecimalPipe, StatusKey],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>Resumen del sistema</h1>
        <p class="lede">
          @if (d(); as x) { Datos al {{ fmtDateTime(x.generatedAt) }}@if (x.deadlines.period) { · Periodo vigente: {{ x.deadlines.period.trimestre }}, {{ x.deadlines.period.aporte }} } }
          @else { Cargando cifras reales… }
        </p>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-outline btn-sm" (click)="load()" [disabled]="loading()">
          <span class="material-symbols-outlined" [class.spin]="loading()" aria-hidden="true">refresh</span>Actualizar
        </button>
      </div>
    </div>

    @if (error()) {
      <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}
        <span class="alert-actions"><button type="button" class="link" (click)="load()">Reintentar</button></span></p>
    }

    <section aria-labelledby="h-stages">
      <h2 id="h-stages" class="sr-only">Solicitudes por estado</h2>
      <div class="stages">
        @for (s of statuses; track s) {
          <a class="stage" [routerLink]="['/superadmin/solicitudes']" [queryParams]="{ status: s }" [class.now]="s === actionStage()"
             [style.--bar]="'var(--st-' + s + ')'">
            @if (d(); as x) { <span class="n">{{ x.requests.byStatus[s] | number }}</span> } @else { <span class="skeleton" style="height:28px;width:56px"></span> }
            <app-status-key [status]="s" [label]="labels[s]" />
            @if (s === actionStage()) { <span class="cap">Requiere acción</span> } @else { <span class="cap">&nbsp;</span> }
          </a>
        }
      </div>
    </section>

    @if (d(); as x) {
      @if (x.maintenance.enabled) {
        <p class="alert alert-warning"><span class="material-symbols-outlined" aria-hidden="true">construction</span>
          Mantenimiento activo{{ x.maintenance.message ? ': ' + x.maintenance.message : '' }}</p>
      }
      <div class="figures">
        <section class="fig-block" aria-labelledby="h-dl">
          <h2 id="h-dl"><span class="material-symbols-outlined" aria-hidden="true">event_busy</span>Plazos de atención
            <a routerLink="/superadmin/solicitudes" [queryParams]="{ due: 'overdue' }">Vencidas</a></h2>
          <dl class="fig-list">
            <div><dt>Vencidas sin resolver</dt><dd [class.bad]="x.deadlines.overdue > 0">{{ x.deadlines.overdue | number }}</dd></div>
            <div><dt>Vencen en 3 días</dt><dd [class.warn]="x.deadlines.dueSoon > 0">{{ x.deadlines.dueSoon | number }}</dd></div>
            <div><dt>Recibidas en 24 h</dt><dd>{{ x.requests.today | number }}</dd></div>
            <div><dt>Total de solicitudes</dt><dd>{{ x.requests.total | number }}</dd></div>
          </dl>
          @for (c of x.deadlines.closingSoon; track $index) {
            <p class="muted small">Cierra el envío: {{ fmtDateTime(c.closesAt) }}</p>
          }
        </section>

        <section class="fig-block" aria-labelledby="h-st">
          <h2 id="h-st"><span class="material-symbols-outlined" aria-hidden="true">school</span>Estudiantes
            <a routerLink="/superadmin/estudiantes">Ver fichas</a></h2>
          <dl class="fig-list">
            <div><dt>Con cuenta</dt><dd>{{ x.students.total | number }}</dd></div>
            <div><dt>Datos completos</dt><dd>{{ x.students.profileCompleted | number }}</dd></div>
            <div><dt>Con solicitudes en el periodo</dt><dd>{{ x.students.withRequestsThisPeriod | number }}</dd></div>
            <div><dt>Sin representante</dt><dd [class.warn]="x.students.withoutRepresentative > 0">{{ x.students.withoutRepresentative | number }}</dd></div>
            <div><dt>Cédula en el padrón</dt><dd>{{ x.students.inPadron | number }}</dd></div>
          </dl>
        </section>

        <section class="fig-block" aria-labelledby="h-rp">
          <h2 id="h-rp"><span class="material-symbols-outlined" aria-hidden="true">family_restroom</span>Representantes
            <a routerLink="/superadmin/inconsistencias">Revisar</a></h2>
          <dl class="fig-list">
            <div><dt>Registrados</dt><dd>{{ x.representatives.total | number }}</dd></div>
            <div><dt>Sin estudiantes vinculados</dt><dd [class.warn]="x.representatives.orphans > 0">{{ x.representatives.orphans | number }}</dd></div>
            <div><dt>Con varios estudiantes</dt><dd>{{ x.representatives.withSeveralStudents | number }}</dd></div>
          </dl>
        </section>

        <section class="fig-block" aria-labelledby="h-us">
          <h2 id="h-us"><span class="material-symbols-outlined" aria-hidden="true">manage_accounts</span>Usuarios
            <a routerLink="/superadmin/usuarios">Gestionar</a></h2>
          <dl class="fig-list">
            @for (r of roles; track r.key) {
              <div><dt>{{ r.label }} activos</dt><dd>{{ x.users[r.key]?.active ?? 0 | number }}</dd></div>
            }
            <div><dt>Cuentas desactivadas</dt><dd>{{ inactiveTotal() | number }}</dd></div>
            <div><dt>Con contraseña temporal</dt><dd>{{ pendingPw() | number }}</dd></div>
          </dl>
        </section>

        <section class="fig-block" aria-labelledby="h-er">
          <h2 id="h-er"><span class="material-symbols-outlined" aria-hidden="true">bug_report</span>Sistema
            <a routerLink="/superadmin/errores">Ver errores</a></h2>
          <dl class="fig-list">
            <div><dt>Errores sin resolver</dt><dd [class.bad]="x.errors.errors > 0">{{ x.errors.errors | number }}</dd></div>
            <div><dt>Advertencias abiertas</dt><dd [class.warn]="x.errors.warnings > 0">{{ x.errors.warnings | number }}</dd></div>
            <div><dt>Ingresos fallidos (24 h)</dt><dd [class.warn]="x.security.failedLogins24h > 20">{{ x.security.failedLogins24h | number }}</dd></div>
          </dl>
        </section>
      </div>

      <div class="split">
        <section class="section" aria-labelledby="h-act">
          <header><h2 id="h-act">Actividad reciente en solicitudes</h2><span class="end"><a routerLink="/superadmin/auditoria">Auditoría completa</a></span></header>
          @if (x.recentActivity.length) {
            <ul class="feed">
              @for (e of x.recentActivity; track e.id) {
                <li>
                  <a [routerLink]="['/superadmin/solicitudes', e.requestId]" class="mono strong">{{ e.requestNumber || '—' }}</a>
                  <span>{{ e.eventLabel }}@if (e.toStatus) { → <app-status-key [status]="e.toStatus" [label]="labels[e.toStatus]" /> }</span>
                  <span class="muted">{{ e.actorName || 'Sistema' }} · {{ fmtAgo(e.createdAt) }}</span>
                </li>
              }
            </ul>
          } @else { <p class="body muted">Todavía no hay movimientos registrados.</p> }
        </section>
        <section class="section" aria-labelledby="h-adm">
          <header><h2 id="h-adm">Cuentas y configuración</h2></header>
          @if (x.recentAdmin.length) {
            <ul class="feed">
              @for (e of x.recentAdmin; track e.id) {
                <li class="two">
                  <span><span class="strong">{{ e.eventLabel }}</span> @if (e.result === 'FAILURE') { <span class="tag bad">Fallido</span> }
                    <span class="sub muted">{{ e.actorEmail || '—' }}@if (e.targetEmail && e.targetEmail !== e.actorEmail) { → {{ e.targetEmail }} }</span></span>
                  <span class="muted">{{ fmtAgo(e.createdAt) }}</span>
                </li>
              }
            </ul>
          } @else { <p class="body muted">Sin eventos de cuentas todavía.</p> }
        </section>
      </div>
    } @else if (loading()) {
      <div class="figures">@for (i of [1, 2, 3, 4]; track i) { <div class="fig-block"><span class="skeleton" style="height:120px"></span></div> }</div>
    }
  `,
  styles: `
    .feed { list-style: none; margin: 0; padding: 4px 0; }
    .feed li > :last-child { white-space: nowrap; }
    .feed li { display: grid; grid-template-columns: 120px 1fr auto; gap: 12px; align-items: center; padding: 9px 18px; border-top: 1px solid var(--surface-container-high); font: var(--body-md); }
    .feed li:first-child { border-top: 0; }
    .feed a { text-decoration: none; }
    .feed li.two { grid-template-columns: 1fr auto; }
    .sub { display: block; font: var(--label-md); font-weight: 400; overflow-wrap: anywhere; }
    .small { font: var(--label-md); font-weight: 400; margin-top: 6px; }
    .section .body { padding: 16px 18px; }
    @media (max-width: 640px) { .feed li { grid-template-columns: 1fr; gap: 2px; } }
  `,
})
export class DashboardPage {
  private readonly api = inject(SaApi);
  readonly d = signal<D | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly statuses = STATUS_ORDER;
  readonly labels = STATUS_LABELS;
  readonly fmtAgo = fmtAgo;
  readonly fmtDateTime = fmtDateTime;
  readonly roles = [{ key: 'SUPERADMIN', label: 'Super administradores' }, { key: 'ADMIN', label: 'Administradores' }, { key: 'STUDENT', label: 'Estudiantes' }];
  /** La etapa que pide acción: la de más volumen entre pendiente y en revisión. */
  readonly actionStage = computed(() => {
    const b = this.d()?.requests.byStatus;
    if (!b) return 'pendiente';
    return (b.en_revision ?? 0) > (b.pendiente ?? 0) ? 'en_revision' : 'pendiente';
  });
  readonly inactiveTotal = computed(() => Object.values(this.d()?.users ?? {}).reduce((n: number, r: any) => n + (r?.inactive ?? 0), 0));
  readonly pendingPw = computed(() => {
    const u = this.d()?.users ?? {};
    return Object.values(u).reduce((n: number, r: any) => n + (r?.pendingPassword ?? 0), 0);
  });

  constructor() { void this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.d.set(await this.api.dashboard());
    } catch (e) {
      this.error.set(apiMessage(e, 'No pudimos cargar el resumen.'));
    } finally {
      this.loading.set(false);
    }
  }
}
