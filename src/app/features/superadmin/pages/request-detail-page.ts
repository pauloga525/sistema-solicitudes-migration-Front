import { EvalChips, EvalChip } from '../../../shared/ui/eval-chips';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COURSE_LABELS_LONG, humanize } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { STATUS_LABELS, downloadBlob, fmtDateTime, toLocalInput } from '../../../shared/ui/format';
import { SkeletonRows, StatusKey } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { HistoryEvent, SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-request-detail',
  imports: [FormsModule, RouterLink, StatusKey, SkeletonRows, EvalChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/superadmin/solicitudes" class="back"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Todas las solicitudes</a>
    @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
    @if (r(); as x) {
      <div class="page-head">
        <div><h1 class="mono">{{ x.requestNumber }}</h1>
          <p class="lede"><app-status-key [status]="x.status" [label]="labels[x.status]" /> · Evaluación de Mejora · recibida el {{ dt(x.createdAt) }}
            @if (x.overdue) { · <span class="tag bad">Plazo vencido</span> }</p></div>
        <div class="actions"><button type="button" class="btn btn-outline btn-sm" (click)="pdf()" [disabled]="busy()">
          <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>Descargar PDF</button></div>
      </div>
      <div class="split">
        <div class="col">
          <section class="section"><header><h2>Datos de la solicitud</h2></header>
            <div class="body"><dl class="kv">
              <dt>Estudiante</dt><dd>{{ x.studentName }} · {{ x.studentDni }}</dd>
              <dt>Representante</dt><dd>{{ x.representativeName }} · {{ x.representativeDni }}</dd>
              <dt>Curso</dt><dd>{{ course(x.course) }} {{ x.paralelo }} · Campus {{ hum(x.campus) }}</dd>
              <dt>Materias y evaluación</dt><dd><app-eval-chips [items]="evals()" [fallback]="x.subjects" /></dd>
              @if (x.rejectionReason) { <dt>Motivo de negación</dt><dd>{{ x.rejectionReason }} <span class="muted">({{ x.rejectedBy }})</span></dd> }
              <dt>Origen</dt><dd>{{ x.legacy ? 'Formulario anterior al registro de estudiantes' : 'Cuenta de estudiante' }}
                @if (x.studentUserId) { · <a [routerLink]="['/superadmin/estudiantes', x.studentUserId]">Ver ficha</a> }</dd>
              <dt>Adjuntos</dt><dd class="muted">Este trámite no admite adjuntos.</dd>
            </dl></div>
          </section>
          <section class="section"><header><h2>Historial y auditoría</h2><span class="end muted">{{ history().length }} eventos</span></header>
            <div class="body">
              <ol class="timeline">
                @for (e of history(); track e.id) {
                  <li [class.corr]="e.eventType === 'STATUS_CORRECTED'">
                    <div class="what">{{ e.eventLabel }}@if (e.toStatus) {<span class="tr">{{ e.fromStatus ? labels[e.fromStatus] + ' → ' : '' }}{{ labels[e.toStatus] }}</span>}</div>
                    <div class="meta">{{ dt(e.createdAt) }} · {{ e.actorName || 'Sistema' }} ({{ e.actorRoleLabel || e.actorRole || 'Sistema' }})@if (e.actorIp) { · IP {{ e.actorIp }} }</div>
                    @if (e.comment) { <div class="note">{{ e.comment }}</div> }
                  </li>
                } @empty { <li><div class="what">Sin eventos</div><div class="meta">Solicitud anterior a la auditoría.</div></li> }
              </ol>
            </div>
          </section>
        </div>
        <div class="col">
          <section class="section"><header><h2>Corregir estado</h2></header>
            <div class="body stack">
              @if (allowed().length) {
                <p class="muted">Solo transiciones válidas. El cambio y su registro de auditoría se guardan juntos y fallan si alguien cambió la solicitud mientras tanto.</p>
                <label class="field"><span class="field-label">Nuevo estado</span>
                  <select class="select" [(ngModel)]="target"><option value="" disabled>Elige…</option>
                    @for (s of allowed(); track s) { <option [value]="s">{{ labels[s] }}{{ isReopen(x.status, s) ? ' (reabrir)' : '' }}</option> }</select></label>
                <button type="button" class="btn btn-primary" [disabled]="!target || busy()" (click)="correct(x.status)">Corregir estado…</button>
              } @else { <p class="muted">No hay transiciones disponibles desde este estado.</p> }
            </div>
          </section>
          <section class="section"><header><h2>Responsable</h2></header>
            <div class="body stack">
              <select class="select" [(ngModel)]="assignee" aria-label="Responsable"><option value="">Sin responsable</option>
                @for (s of staff(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }</select>
              <button type="button" class="btn btn-outline" [disabled]="busy() || assignee === (x.assignedTo || '')" (click)="assign()">Guardar responsable</button>
            </div>
          </section>
          <section class="section"><header><h2>Plazo de atención</h2></header>
            <div class="body stack">
              <label class="field"><span class="field-label">Fecha y hora (Ecuador)</span><input class="input" type="datetime-local" [(ngModel)]="due" /></label>
              <div class="row">
                <button type="button" class="btn btn-outline" [disabled]="busy() || !due" (click)="saveDue()">Guardar plazo</button>
                @if (x.dueAt) { <button type="button" class="btn btn-text" [disabled]="busy()" (click)="clearDue()">Quitar plazo</button> }
              </div>
            </div>
          </section>
          <section class="section danger-zone"><header><h2>Eliminar solicitud</h2></header>
            <div class="body stack">
              <p class="muted small">Para solicitudes de prueba o enviadas por error. Se borra de forma permanente junto con su seguimiento docente y sus avisos, y deja de contar para el cupo y los límites del estudiante. Se conservan su historial y una copia de sus datos en la auditoría. Si solo quieres anularla, usa «Corregir estado».</p>
              <div class="row"><button type="button" class="btn btn-danger-outline" [disabled]="busy()" (click)="remove(x)">
                <span class="material-symbols-outlined" aria-hidden="true">delete_forever</span>Eliminar solicitud…</button></div>
            </div>
          </section>
        </div>
      </div>
    } @else if (!error()) { <app-skeleton-rows [rows]="8" [cols]="3" /> }
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font: var(--label-lg); width: fit-content; }
    .col { display: grid; gap: 16px; align-content: start; }
    .stack { display: grid; gap: 10px; }
    .row { display: flex; gap: 8px; }
    h1.mono { font-variant-numeric: tabular-nums; }
    .tr { font-weight: 400; color: var(--on-surface-variant); margin-left: 8px; }
    .small { font: var(--label-md); font-weight: 400; margin: 0; }
    .danger-zone { border-color: color-mix(in srgb, var(--error) 35%, var(--outline-variant)); }
    .lede { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
  `,
})
export class RequestDetailPage {
  private readonly api = inject(SaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly id = input.required<string>();
  readonly r = signal<any>(null);
  readonly history = signal<HistoryEvent[]>([]);
  readonly evals = signal<EvalChip[]>([]);
  readonly allowed = signal<string[]>([]);
  readonly staff = signal<{ id: string; name: string }[]>([]);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly labels = STATUS_LABELS;
  readonly dt = fmtDateTime;
  readonly hum = humanize;
  target = ''; assignee = ''; due = '';

  constructor() {
    queueMicrotask(() => void this.load());
    this.api.staff().then((s) => this.staff.set(s), () => undefined);
  }

  course(c: string) { return COURSE_LABELS_LONG[c] ?? c; }
  isReopen(from: string, to: string) { return ['aprobado', 'rechazado', 'cancelado'].includes(from) && ['pendiente', 'en_revision'].includes(to); }

  private apply(d: any) {
    this.r.set(d.request);
    this.history.set(d.history);
    this.evals.set(d.evaluations ?? []);
    this.allowed.set(d.allowedCorrections ?? []);
    this.assignee = d.request.assignedTo ?? '';
    this.due = toLocalInput(d.request.dueAt);
    this.target = '';
  }

  async load() {
    try { this.apply(await this.api.request(this.id())); } catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar la solicitud.')); }
  }

  private async run(fn: () => Promise<unknown>, ok: string) {
    this.busy.set(true);
    try { await fn(); this.toast.ok(ok); await this.load(); }
    catch (e) { this.toast.error(apiMessage(e, 'No se pudo completar la acción.')); await this.load(); }
    finally { this.busy.set(false); }
  }

  async remove(x: any) {
    const num = x.requestNumber as string;
    const reason = await this.confirm.ask({
      title: `Eliminar la solicitud ${num}`, confirmLabel: 'Eliminar definitivamente', reasonMin: 10, typeToConfirm: num,
      risk: `Se borra ${num} de ${x.studentName} de forma permanente, con su seguimiento docente y sus avisos. No se puede deshacer. El estudiante recupera el cupo de esas materias.`,
    });
    if (reason === null) return;
    this.busy.set(true);
    try {
      await this.api.deleteRequest(this.id(), reason, num);
      this.toast.ok(`Solicitud ${num} eliminada`);
      void this.router.navigate(x.studentUserId ? ['/superadmin/estudiantes', x.studentUserId] : ['/superadmin/solicitudes']);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo eliminar la solicitud.')); }
    finally { this.busy.set(false); }
  }

  async correct(current: string) {
    const to = this.target;
    const reason = await this.confirm.ask({
      title: `Cambiar a «${STATUS_LABELS[to]}»`, confirmLabel: 'Corregir estado', reasonMin: 10, reasonLabel: 'Motivo de la corrección',
      risk: this.isReopen(current, to)
        ? 'Reabres una solicitud que estaba cerrada. El estudiante y el personal la verán activa otra vez.'
        : 'El cambio se registra a tu nombre en el historial y no se puede borrar.',
    });
    if (reason === null) return;
    await this.run(() => this.api.correct(this.id(), current, to, reason), 'Estado corregido');
  }

  assign() { return this.run(() => this.api.assign(this.id(), this.assignee || null), 'Responsable actualizado'); }
  saveDue() { return this.run(() => this.api.setDue(this.id(), this.due), 'Plazo guardado'); }
  clearDue() { return this.run(() => this.api.setDue(this.id(), null), 'Plazo retirado'); }

  async pdf() {
    try { downloadBlob(await this.api.requestPdf(this.id()), `solicitud-${this.r()?.requestNumber}.pdf`); }
    catch (e) { this.toast.error(apiMessage(e, 'No pudimos generar el PDF.')); }
  }
}
