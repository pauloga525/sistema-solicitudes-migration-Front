import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiMessage } from '../../../core/utils/errors';
import { fmtDateTime } from '../../../shared/ui/format';
import { fmtLocal } from '../activacion/activacion-page';
import { EvalEstado, ExpEvent, Expediente, SeguimientoApi } from './seguimiento-api';

export const ESTADO_TAG: Record<EvalEstado, string> = {
  sin_docente: 'bad', por_atender: 'warn', programada: 'info', vencida: 'bad', evaluado: 'ok', no_asistio: 'bad', no_requiere: '',
};

/**
 * Expediente de seguimiento de una solicitud: docente asignado a cada materia, qué registró y cada aviso y correo
 * enviado (con la hora en que se leyó o se envió). Sirve para responder a un representante con datos.
 */
@Component({
  selector: 'app-expediente',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }
    @if (exp(); as x) {
      @if (x.subjects.length) {
        <section class="section" aria-labelledby="exp-ev">
          <header><span class="material-symbols-outlined hicon" aria-hidden="true">co_present</span><h2 id="exp-ev">Evaluación por materia</h2></header>
          <div class="body subjects">
            @for (s of x.subjects; track s.subject) {
              <article class="subj">
                <div class="shead"><h3>{{ s.subject }}</h3><span class="tag" [class]="'tag ' + tag[s.estado]">{{ s.estadoLabel }}</span></div>
                <dl class="kv">
                  <dt>Docente</dt>
                  <dd>
                    @for (t of s.teachers; track $index) {
                      <span class="tline"><b>{{ t.name }}</b>@if (t.email) { · {{ t.email }} }
                        <small class="muted">{{ t.hasAccount === false ? 'sin cuenta (no puede ingresar)' : t.lastLoginAt ? 'último ingreso ' + dt(t.lastLoginAt) : t.hasAccount ? 'aún no ha ingresado' : '' }}</small></span>
                    } @empty { <span class="bad-text">Sin docente asignado en el distributivo</span> }
                    @if (!s.snapshot && s.teachers.length) { <small class="muted block">Según el distributivo vigente.</small> }
                  </dd>
                  <dt>Fecha programada</dt><dd>{{ s.scheduledAt ? local(s.scheduledAt) : 'No programada' }}</dd>
                  <dt>Registro del docente</dt>
                  <dd>@if (s.doneAt) { {{ s.trackLabel }} · {{ dt(s.doneAt) }}@if (s.updatedBy) { · {{ s.updatedBy }} } }
                      @else if (s.updatedAt) { {{ s.trackLabel }} · actualizado {{ dt(s.updatedAt) }}@if (s.updatedBy) { · {{ s.updatedBy }} } }
                      @else { Aún no registra nada }</dd>
                  @if (s.note) { <dt>Nota del docente</dt><dd>{{ s.note }}</dd> }
                </dl>
              </article>
            }
          </div>
        </section>
      }

      <section class="section" aria-labelledby="exp-tl">
        <header><span class="material-symbols-outlined hicon" aria-hidden="true">history</span><h2 id="exp-tl">Línea de tiempo y constancia de avisos</h2>
          @if (x.subjects.length > 1) {
            <span class="end"><label class="sr-only" for="exp-sub">Materia</label>
              <select id="exp-sub" class="select sm" [ngModel]="subject()" (ngModelChange)="subject.set($event)">
                <option value="">Todas las materias</option>
                @for (s of x.subjects; track s.subject) { <option [value]="s.subject">{{ s.subject }}</option> }
              </select></span>
          }
        </header>
        <div class="body">
          <ol class="tl">
            @for (e of events(); track $index) {
              <li [class]="'t-' + e.type">
                <span class="dot"><span class="material-symbols-outlined" aria-hidden="true">{{ e.icon }}</span></span>
                <div class="ev">
                  <div class="top"><strong>{{ e.title }}</strong><time class="muted tnum">{{ dt(e.at) }}</time></div>
                  @if (e.detail) { <p class="det">{{ e.detail }}</p> }
                  <p class="meta">
                    @if (e.subject) { <span class="chip">{{ e.subject }}</span> }
                    @if (e.who) { <span class="muted">{{ e.who }}</span> }
                    @if (e.type === 'aviso') {
                      <span class="chip" [class.ok]="e.read">{{ e.read ? 'Leído' + (e.readAt ? ' ' + dt(e.readAt) : '') : 'Aún no leído' }}</span>
                    }
                    @if (e.type === 'correo') {
                      <span class="chip" [class.ok]="e.mailStatus === 'enviado'" [class.bad]="e.mailStatus === 'fallido'" [class.warn]="e.mailStatus === 'sin_configurar'">
                        {{ e.mailStatusLabel }}{{ e.sentAt ? ' ' + dt(e.sentAt) : '' }}</span>
                    }
                  </p>
                  @if (e.mailError) { <p class="merr">{{ e.mailError }}</p> }
                  @if (e.comment) { <p class="cmt">“{{ e.comment }}”</p> }
                </div>
              </li>
            } @empty { <li class="muted">Sin eventos.</li> }
          </ol>
          @if (hasUnsent()) {
            <p class="alert alert-info small"><span class="material-symbols-outlined" aria-hidden="true">info</span>
              Hay correos que no salieron porque el envío de correo no está configurado en el servidor. Los avisos dentro del sistema sí se registraron.</p>
          }
        </div>
      </section>
    } @else if (!error()) {
      <div class="skeleton" style="height: 220px; border-radius: 16px" role="status" aria-label="Cargando seguimiento"></div>
    }
  `,
  styles: `
    :host { display: grid; gap: 16px; }
    .section header .end { margin-left: auto; }
    .select.sm { min-height: 34px; padding-block: 4px; }
    .subjects { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .subj { border: 1px solid var(--outline-variant); border-radius: var(--radius-md); padding: 14px; display: grid; gap: 10px; background: var(--surface-container-lowest); }
    .shead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .shead h3 { font: var(--title-md); margin: 0; }
    .tline { display: block; }
    .tline small { display: block; }
    .block { display: block; }
    .bad-text { color: var(--error); font-weight: 600; }
    .tl { list-style: none; margin: 0; padding: 0; display: grid; }
    .tl li { display: grid; grid-template-columns: 32px 1fr; gap: 12px; padding: 10px 0; position: relative; }
    .tl li + li { border-top: 1px solid var(--surface-container-high); }
    .dot { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-container-high); color: var(--on-surface-variant); }
    .dot .material-symbols-outlined { font-size: 18px; }
    .t-docente .dot { background: var(--primary-fixed); color: var(--on-primary-fixed); }
    .t-aviso .dot { background: #fff1c9; color: #5c4300; }
    .t-correo .dot { background: var(--success-container); color: var(--on-success-container); }
    .top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .top time { font: var(--label-md); white-space: nowrap; }
    .det { margin: 2px 0 0; font: var(--body-md); word-break: break-word; }
    .meta { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font: var(--label-md); }
    .chip { padding: 2px 8px; border-radius: 6px; background: var(--surface-container-high); }
    .chip.ok { background: var(--success-container); color: var(--on-success-container); }
    .chip.bad { background: var(--error-container); color: var(--on-error-container); }
    .chip.warn { background: var(--warning-container); color: #4a2c00; }
    .merr { margin: 6px 0 0; font: var(--label-md); font-weight: 400; color: var(--error); }
    .cmt { margin: 6px 0 0; font-style: italic; color: var(--on-surface-variant); }
    .small { font-size: 0.875rem; margin-top: 12px; }
  `,
})
export class ExpedienteView {
  private readonly api = inject(SeguimientoApi);
  readonly requestId = input.required<string>();
  /** Cambia para volver a cargar (p. ej. después de aprobar o negar). */
  readonly refresh = input(0);
  readonly loaded = output<void>();
  readonly exp = signal<Expediente | null>(null);
  readonly error = signal<string | null>(null);
  readonly subject = signal('');
  readonly tag = ESTADO_TAG;
  readonly dt = fmtDateTime;
  readonly local = fmtLocal;

  readonly events = computed<ExpEvent[]>(() => {
    const x = this.exp();
    const s = this.subject();
    return x ? x.timeline.filter((e) => !s || !e.subject || e.subject === s) : [];
  });
  readonly hasUnsent = computed(() => (this.exp()?.timeline ?? []).some((e) => e.mailStatus === 'sin_configurar'));

  constructor() {
    effect(() => {
      const id = this.requestId();
      this.refresh();
      this.error.set(null);
      this.api.expediente(id).then((x) => { this.exp.set(x); queueMicrotask(() => this.loaded.emit()); }, (e) => this.error.set(apiMessage(e, 'No se pudo cargar el seguimiento.')));
    });
  }
}
