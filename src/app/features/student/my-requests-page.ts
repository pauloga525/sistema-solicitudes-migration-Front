import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { COURSE_LABELS_LONG } from '../../core/catalogs';
import { apiMessage } from '../../core/utils/errors';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { STATUS_LABELS, downloadBlob, fmtDate, fmtDateTime } from '../../shared/ui/format';
import { EmptyState, SkeletonRows, StatusKey } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast.service';
import { MeApi, MyRequest } from './me-api.service';

@Component({
  selector: 'app-my-requests',
  imports: [RouterLink, StatusKey, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Hola{{ first() ? ', ' + first() : '' }}</h1>
        <p class="lede">Aquí ves tus solicitudes y su estado. El comprobante PDF se descarga desde cada una.</p></div>
      <div class="actions">
        @if (session.user()?.profileCompleted && quota()?.aporte && quota()?.disponible === 0) {
          <button type="button" class="btn btn-gold" disabled>Nueva solicitud</button>
        } @else if (session.user()?.profileCompleted) {
          <a routerLink="/solicitud" class="btn btn-gold"><span class="material-symbols-outlined" aria-hidden="true">add</span>Nueva solicitud</a>
        }
      </div>
    </div>

    @if (!session.user()?.profileCompleted) {
      <div class="alert alert-warning" role="status"><span class="material-symbols-outlined" aria-hidden="true">assignment_ind</span>
        <span>Antes de tu primera solicitud completa tus datos y los de tu representante.</span>
        <span class="alert-actions"><a routerLink="/estudiante/perfil" class="btn btn-primary btn-sm">Completar mis datos</a></span></div>
    }

    @if (quota(); as q) {
      @if (q.aporte) {
        <section class="quota" aria-label="Cupo de materias">
          <div><span class="muted">Periodo vigente</span><strong>{{ q.aporte.trimestre }} · {{ q.aporte.name }}</strong><span class="muted">hasta el {{ d(q.aporte.endDate) }}</span></div>
          <div class="meter" role="meter" [attr.aria-valuenow]="q.consumido" aria-valuemin="0" [attr.aria-valuemax]="q.limite" [attr.aria-label]="'Materias usadas: ' + q.consumido + ' de ' + q.limite">
            @for (i of slots(q.limite); track i) { <span [class.used]="i < q.consumido"></span> }
          </div>
          <div class="right"><strong class="tnum">{{ q.disponible }}</strong><span class="muted">materias disponibles de {{ q.limite }}</span>
            @if (q.disponible === 0) { <span class="muted">Ya usaste las {{ q.limite }} materias de este aporte.</span> }</div>
        </section>
      } @else {
        <p class="alert alert-info"><span class="material-symbols-outlined" aria-hidden="true">event_busy</span>No hay un periodo de solicitudes abierto en este momento.</p>
      }
    }

    <section class="section">
      <header><h2>Mis solicitudes</h2></header>
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (rows() === null) { <app-skeleton-rows [rows]="3" [cols]="4" /> }
      @else if (rows()!.length) {
        <ul class="reqs">
          @for (r of rows()!; track r._id) {
            <li>
              <div class="top">
                <span class="mono strong">{{ r.requestNumber }}</span>
                <app-status-key [status]="r.status" [label]="labels[r.status]" />
              </div>
              <p class="subj">{{ (r.payload.subjects || []).join(', ') }}</p>
              <p class="muted small">Evaluación de Mejora · {{ course(r.course) }} {{ r.paralelo }} · enviada el {{ dt(r.createdAt) }}</p>
              @if (r.status === 'rechazado' && r.rejectionReason) { <p class="reason">Motivo: {{ r.rejectionReason }}</p> }
              <div class="act">
                <button type="button" class="btn btn-outline btn-sm" (click)="pdf(r)"><span class="material-symbols-outlined" aria-hidden="true">download</span>Comprobante PDF</button>
                @if (r.status === 'pendiente' || r.status === 'en_revision') {
                  <button type="button" class="btn btn-text btn-sm" (click)="cancel(r)">Cancelar solicitud</button>
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <app-empty icon="description" title="Aún no has enviado solicitudes" text="Cuando envíes una, verás aquí su estado y podrás descargar el comprobante." />
      }
    </section>
  `,
  styles: `
    .quota { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; align-items: center; padding: 16px 18px; border-radius: var(--radius-md);
      background: var(--surface-container-lowest); border: 1px solid var(--outline-variant); }
    .quota > div:first-child, .quota .right { display: grid; gap: 2px; }
    .quota .right { text-align: right; } .quota .right strong { font: 650 1.75rem/1 var(--font-sans); color: var(--primary); }
    .meter { display: flex; gap: 6px; } .meter span { flex: 1; height: 10px; border-radius: 3px; background: var(--surface-container-high); }
    .meter span.used { background: var(--primary); }
    .reqs { list-style: none; margin: 0; padding: 0; }
    .reqs li { padding: 14px 18px; border-top: 1px solid var(--surface-container-high); display: grid; gap: 4px; }
    .reqs li:first-child { border-top: 0; }
    .top { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .subj { font: var(--body-lg); }
    .small { font: var(--label-md); font-weight: 400; }
    .reason { color: var(--on-error-container); background: var(--error-container); padding: 6px 10px; border-radius: 8px; }
    .act { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    @media (max-width: 640px) { .quota { grid-template-columns: 1fr; } .quota .right { text-align: left; } }
  `,
})
export class MyRequestsPage {
  private readonly api = inject(MeApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly session = inject(SessionService);
  readonly rows = signal<MyRequest[] | null>(null);
  readonly quota = signal<any>(null);
  readonly error = signal<string | null>(null);
  readonly labels = STATUS_LABELS;
  readonly dt = fmtDateTime;
  readonly d = fmtDate;
  readonly first = () => (this.session.user()?.name ?? '').split(' ')[0] ?? '';

  constructor() { void this.load(); }
  course(c: string) { return COURSE_LABELS_LONG[c] ?? c; }
  slots(n: number) { return Array.from({ length: n }, (_, i) => i); }

  async load() {
    try { this.rows.set((await this.api.requests()).data); } catch (e) { this.rows.set([]); this.error.set(apiMessage(e, 'No pudimos cargar tus solicitudes.')); }
    if (this.session.user()?.profileCompleted) this.api.quota().then((q) => this.quota.set(q), () => undefined);
  }
  async pdf(r: MyRequest) {
    try { downloadBlob(await this.api.pdf(r._id), `solicitud-${r.requestNumber}.pdf`); } catch (e) { this.toast.error(apiMessage(e, 'No pudimos generar el PDF.')); }
  }
  async cancel(r: MyRequest) {
    const ok = await this.confirm.ask({ title: `Cancelar ${r.requestNumber}`, confirmLabel: 'Sí, cancelar',
      risk: 'La solicitud deja de tramitarse y no se puede reactivar desde tu cuenta. Las materias vuelven a tu cupo disponible.' });
    if (ok === null) return;
    try { await this.api.cancel(r._id); this.toast.ok('Solicitud cancelada'); void this.load(); } catch (e) { this.toast.error(apiMessage(e)); }
  }
}
