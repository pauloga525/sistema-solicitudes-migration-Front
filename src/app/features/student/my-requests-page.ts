import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { COURSE_LABELS_LONG } from '../../core/catalogs';
import { apiMessage } from '../../core/utils/errors';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { STATUS_LABELS, downloadBlob, fmtAgo, fmtDate, fmtDateTime } from '../../shared/ui/format';
import { fmtSchedule } from '../teacher/pages/teacher-format';
import { EmptyState, SkeletonRows, StatusKey } from '../../shared/ui/states';
import { ToastService } from '../../shared/ui/toast.service';
import { Evaluation, MeApi, MyRequest, StudentNotice } from './me-api.service';

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

    @if (unread().length) {
      <section class="section news" aria-labelledby="news-h">
        <header><span class="material-symbols-outlined bell" aria-hidden="true">notifications_active</span><h2 id="news-h">Novedades</h2>
          <span class="end"><button type="button" class="btn btn-text btn-sm" (click)="readAll()">Marcar como leídas</button></span></header>
        <ul class="nl">
          @for (n of unread(); track n.id) {
            <li><span class="material-symbols-outlined ic" aria-hidden="true">event</span>
              <span><strong>{{ n.title }}</strong><small>{{ n.body }} · {{ ago(n.createdAt) }}</small></span></li>
          }
        </ul>
      </section>
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
              <ul class="subjs">
                @for (s of r.payload.subjects || []; track s) {
                  <li><span class="sname">{{ s }}</span>
                    @if (evalOf(r, s); as e) {
                      @if (e.track === 'programada' && e.scheduledAt && r.status !== 'cancelado' && r.status !== 'rechazado') {
                        <span class="ev"><span class="material-symbols-outlined" aria-hidden="true">event</span>{{ e.missedCount ? 'Evaluación reprogramada' : 'Evaluación' }}: <b>{{ when(e.scheduledAt) }}</b>@if (e.teacher) { · {{ e.teacher }} }</span>
                        @if (e.note) { <span class="evnote"><span class="material-symbols-outlined" aria-hidden="true">sticky_note_2</span>Indicaciones del docente: {{ e.note }}</span> }
                      } @else if (e.track === 'evaluado') {
                        <span class="ev done"><span class="material-symbols-outlined" aria-hidden="true">task_alt</span>Evaluación rendida</span>
                      } @else if (e.track === 'no_asistio') {
                        <span class="ev miss"><span class="material-symbols-outlined" aria-hidden="true">event_busy</span>No te presentaste a la evaluación@if (e.scheduledAt) { del {{ when(e.scheduledAt) }} }</span>
                      }
                    }
                  </li>
                }
              </ul>
              <p class="muted small">Evaluación de Mejora · {{ course(r.course) }} {{ r.paralelo }} · enviada el {{ dt(r.createdAt) }}</p>
              @if (r.status === 'rechazado' && r.rejectionReason) { <p class="reason">Motivo: {{ r.rejectionReason }}</p> }
              <div class="act">
                <button type="button" class="btn btn-outline btn-sm" (click)="pdf(r)"><span class="material-symbols-outlined" aria-hidden="true">download</span>Comprobante PDF</button>
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
    .reqs > li { padding: 14px 18px; border-top: 1px solid var(--surface-container-high); display: grid; gap: 4px; }
    .reqs > li:first-child { border-top: 0; }
    .top { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .subjs { list-style: none; margin: 2px 0; padding: 0; display: grid; gap: 4px; }
    .subjs li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
    .sname { font: var(--body-lg); }
    .ev { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 8px; background: var(--primary-fixed);
      color: var(--on-primary-fixed); font: var(--label-md); font-weight: 500; }
    .ev .material-symbols-outlined { font-size: 16px; }
    .ev.done { background: var(--success-container); color: var(--on-success-container); }
    .evnote { display: flex; align-items: flex-start; gap: 6px; flex-basis: 100%; margin-top: 4px; padding: 6px 10px; border-radius: 8px;
      background: #fff6d6; color: #4a3800; font: var(--body-md); font-size: 0.875rem; }
    .evnote .material-symbols-outlined { font-size: 16px; margin-top: 2px; }
    .ev.miss { background: var(--error-container); color: var(--on-error-container); }
    .news .bell { color: #5c4700; font-size: 20px; }
    .nl { list-style: none; margin: 0; padding: 4px 0; }
    .nl li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 18px; }
    .nl li + li { border-top: 1px solid var(--surface-container-high); }
    .nl strong { display: block; font: var(--label-lg); }
    .nl small { color: var(--on-surface-variant); font: var(--body-md); font-size: 0.8125rem; }
    .nl .ic { color: var(--primary-container); font-size: 20px; margin-top: 1px; }
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
  readonly ago = fmtAgo;
  readonly when = fmtSchedule;
  readonly notices = signal<StudentNotice[]>([]);
  readonly unread = () => this.notices().filter((n) => !n.read);
  readonly first = () => (this.session.user()?.name ?? '').split(' ')[0] ?? '';

  constructor() { void this.load(); }
  course(c: string) { return COURSE_LABELS_LONG[c] ?? c; }
  evalOf(r: MyRequest, s: string): Evaluation | undefined { return r.evaluations?.find((e) => e.subject === s); }
  async readAll() {
    try { await this.api.readNotifications('all'); this.notices.update((l) => l.map((n) => ({ ...n, read: true }))); } catch (e) { this.toast.error(apiMessage(e)); }
  }
  slots(n: number) { return Array.from({ length: n }, (_, i) => i); }

  async load() {
    try { this.rows.set((await this.api.requests()).data); } catch (e) { this.rows.set([]); this.error.set(apiMessage(e, 'No pudimos cargar tus solicitudes.')); }
    if (this.session.user()?.profileCompleted) this.api.quota().then((q) => this.quota.set(q), () => undefined);
    this.api.notifications().then((n) => this.notices.set(n), () => undefined);
  }
  async pdf(r: MyRequest) {
    try { downloadBlob(await this.api.pdf(r._id), `solicitud-${r.requestNumber}.pdf`); } catch (e) { this.toast.error(apiMessage(e, 'No pudimos generar el PDF.')); }
  }
}
