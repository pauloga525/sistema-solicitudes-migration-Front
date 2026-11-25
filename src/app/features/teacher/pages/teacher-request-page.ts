import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { COURSE_LABELS_LONG, humanize } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { printBlob, viewBlob } from '../../../core/utils/pdf';
import { STATUS_LABELS, fmtDateTime } from '../../../shared/ui/format';
import { ToastService } from '../../../shared/ui/toast.service';
import { TeacherApi } from '../teacher-api';
import { CLOSED_REQUEST, TRACK_LABELS, TeacherItemDetail, TrackStatus } from '../teacher.models';
import { fmtSchedule } from './teacher-format';

/** Una solicitud abierta por el docente: datos, su seguimiento (programar, evaluado, no se presentó) e historial. */
@Component({
  selector: 'app-teacher-request',
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/docente/solicitudes" class="back"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Solicitudes</a>
    @if (error()) {
      <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p>
    } @else if (d(); as x) {
      <div class="page-head">
        <div><h1 class="tnum">{{ x.requestNumber }}</h1>
          <p class="lede"><span class="key" [class]="'key k-' + x.requestStatus"><span class="sq" aria-hidden="true"></span>{{ status[x.requestStatus] ?? x.requestStatus }}</span>
            · Evaluación de Mejora · recibida el {{ dt(x.submittedAt) }}</p></div>
        <div class="actions">
          <button type="button" class="btn btn-outline" (click)="openPdf('ver')" [disabled]="pdfBusy()">
            <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>Ver PDF</button>
          <button type="button" class="btn btn-outline" (click)="openPdf('imprimir')" [disabled]="pdfBusy()">
            <span class="material-symbols-outlined" aria-hidden="true">print</span>Imprimir</button>
        </div>
      </div>

      @if (closed()) {
        <div class="banner muted-b"><span class="material-symbols-outlined" aria-hidden="true">info</span>
          <p><strong>No requiere evaluación.</strong> La solicitud fue {{ x.requestStatus === 'cancelado' ? 'cancelada por el estudiante' : 'rechazada por la administración' }}.</p></div>
      } @else if (x.track === 'por_atender') {
        <div class="banner"><span class="material-symbols-outlined" aria-hidden="true">event</span>
          <p><strong>Programa la evaluación.</strong> Elige fecha y hora en «Tu seguimiento»; el estudiante y su representante reciben el aviso.</p></div>
      }

      <div class="split">
        <div class="col">
          <section class="section" aria-labelledby="h-sol">
            <header><h2 id="h-sol">Solicitud</h2></header>
            <div class="body">
              <dl class="kv">
                <dt>Número</dt><dd class="tnum strong">{{ x.requestNumber }}</dd>
                <dt>Curso</dt><dd>{{ long(x.course) }}, paralelo {{ x.paralelo }}</dd>
                @if (x.campus) { <dt>Campus</dt><dd>{{ hum(x.campus) }}</dd> }
                <dt>Fecha</dt><dd>{{ dt(x.submittedAt) }}</dd>
                <dt>Materia</dt><dd class="strong">{{ x.subject }}</dd>
                @if (x.coTeachers.length) { <dt>También la atiende</dt><dd>{{ x.coTeachers.join(', ') }}</dd> }
              </dl>
            </div>
          </section>

          <section class="section track" aria-labelledby="h-track">
            <header><span class="material-symbols-outlined hicon" aria-hidden="true">event_note</span><h2 id="h-track">Tu seguimiento</h2>
              <span class="end"><span class="key" [class]="'key t-' + (closed() ? 'cerrada' : x.track)"><span class="sq" aria-hidden="true"></span>{{ closed() ? 'No requiere evaluación' : labels[x.track] }}</span></span></header>
            <div class="body">
              @if (closed()) {
                <p class="muted">La solicitud fue {{ x.requestStatus === 'cancelado' ? 'cancelada' : 'rechazada' }}: no requiere evaluación.</p>
              } @else if (final()) {
                <div class="result" [class.bad]="x.track === 'no_asistio'">
                  <span class="material-symbols-outlined" aria-hidden="true">{{ x.track === 'evaluado' ? 'task_alt' : 'event_busy' }}</span>
                  <div><strong>{{ x.track === 'evaluado' ? 'El estudiante rindió la evaluación' : 'El estudiante no se presentó' }}</strong>
                    <p>Registrado{{ x.doneAt ? ' el ' + dt(x.doneAt) : '' }}{{ x.updatedBy ? ' por ' + x.updatedBy : '' }}{{ x.scheduledAt ? ' · evaluación del ' + schedule(x.scheduledAt) : '' }}. Este registro es definitivo.</p>
                    @if (x.note) { <p class="muted">Nota: {{ x.note }}</p> }</div>
                </div>
              } @else if (x.track === 'programada' && x.scheduledAt) {
                <p class="when"><span class="material-symbols-outlined" aria-hidden="true">event</span>Programada para el <strong>{{ schedule(x.scheduledAt) }}</strong></p>
                @if (x.note) { <p class="cur-note"><span class="material-symbols-outlined" aria-hidden="true">sticky_note_2</span>{{ x.note }}</p> }
                <p class="field-label">Registra el resultado</p>
                <div class="outcome">
                  <button type="button" class="btn btn-success" (click)="markEvaluated()" [disabled]="saving()">
                    <span class="material-symbols-outlined" aria-hidden="true">task_alt</span>Rindió la evaluación</button>
                  <button type="button" class="btn btn-danger-outline" (click)="openMissed()" [disabled]="saving()">
                    <span class="material-symbols-outlined" aria-hidden="true">event_busy</span>No se presentó</button>
                </div>
                <details class="edit" [open]="editOpen">
                  <summary>Cambiar la fecha o la nota</summary>
                  <ng-container *ngTemplateOutlet="scheduleForm; context: { label: 'Guardar cambios' }" />
                </details>
              } @else {
                <p class="muted intro">Fija la fecha y hora de la evaluación. Cuando esté programada podrás registrar si el estudiante la rindió o no se presentó.</p>
                <ng-container *ngTemplateOutlet="scheduleForm; context: { label: 'Programar y avisar al estudiante' }" />
              }
              @if (saveError()) { <p class="alert alert-error" role="alert">{{ saveError() }}</p> }
            </div>

            <ng-template #scheduleForm let-label="label">
              <form class="form" (submit)="$event.preventDefault(); schedule_()">
                <div class="field"><label class="field-label" for="d-when">Fecha y hora de la evaluación</label>
                  <input id="d-when" class="input" type="datetime-local" name="when" [(ngModel)]="f.scheduledAt" required /></div>
                <div class="field"><label class="field-label" for="d-note">Nota para el estudiante (opcional)</label>
                  <textarea id="d-note" class="textarea" name="note" rows="2" maxlength="300" [(ngModel)]="f.note" placeholder="Ej.: Aula 12, traer calculadora"></textarea>
                  <span class="field-hint">El estudiante la ve en el sistema y en el correo.</span></div>
                @if (f.scheduledAt) {
                  <p class="notify" role="note"><span class="material-symbols-outlined" aria-hidden="true">forward_to_inbox</span>
                    <span>Al guardar, el estudiante recibirá un aviso en el sistema y un correo, con copia al correo de su representante.</span></p>
                }
                <div class="form-actions">
                  <button type="submit" class="btn btn-primary" [disabled]="saving() || !f.scheduledAt || !changed()">
                    <span class="material-symbols-outlined" aria-hidden="true">save</span>{{ saving() ? 'Guardando…' : label }}</button>
                </div>
              </form>
            </ng-template>
          </section>
        </div>

        <div class="col">
          <section class="section" aria-labelledby="h-hist">
            <header><span class="material-symbols-outlined hicon" aria-hidden="true">history</span><h2 id="h-hist">Historial</h2></header>
            <div class="body">
              <ol class="hist">
                @for (h of x.history; track $index) {
                  <li><div class="what">{{ h.title }}</div>
                    <div class="meta">{{ dt(h.at) }}@if (h.who) { · {{ h.who }} }</div>
                    @if (h.note) { <div class="note">{{ h.note }}</div> }</li>
                }
              </ol>
              @if (x.studentNotice; as n) {
                <p class="seen" [class.ok]="n.read"><span class="material-symbols-outlined" aria-hidden="true">{{ n.read ? 'mark_email_read' : 'mail' }}</span>
                  {{ n.read ? 'El estudiante vio el aviso de la evaluación' + (n.readAt ? ' el ' + dt(n.readAt) : '') : 'Aviso enviado al estudiante; aún no lo ve en el sistema' }}{{ n.mailStatus === 'enviado' ? ' · correo enviado' : '' }}.</p>
              }
            </div>
          </section>
          <section class="section" aria-labelledby="h-est">
            <header><span class="material-symbols-outlined hicon" aria-hidden="true">school</span><h2 id="h-est">Estudiante</h2></header>
            <div class="body"><dl class="kv"><dt>Nombre</dt><dd>{{ x.studentName }}</dd><dt>Curso</dt><dd>{{ long(x.course) }} {{ x.paralelo }}</dd></dl></div>
          </section>
          @if (x.representativeName) {
            <section class="section" aria-labelledby="h-rep">
              <header><span class="material-symbols-outlined hicon" aria-hidden="true">family_restroom</span><h2 id="h-rep">Representante</h2></header>
              <div class="body"><dl class="kv"><dt>Nombre</dt><dd>{{ x.representativeName }}</dd></dl></div>
            </section>
          }
        </div>
      </div>

      <dialog #missDlg class="dialog miss" aria-labelledby="miss-title" (close)="missOpen.set(false)">
        @if (missOpen()) {
          <form (submit)="$event.preventDefault(); confirmMissed()">
            <div class="dialog-head"><span class="d-icon"><span class="material-symbols-outlined" aria-hidden="true">event_busy</span></span>
              <h2 id="miss-title" class="dtitle">¿Confirmas que {{ x.studentName }} no se presentó a la evaluación de mejora?</h2></div>
            <div class="dialog-body">
              <fieldset class="opts"><legend class="field-label">¿Qué hacemos ahora?</legend>
                <label class="opt-row" [class.on]="miss.mode === 'reprogramar'">
                  <input type="radio" name="mm" value="reprogramar" [(ngModel)]="miss.mode" />
                  <strong>Reprogramar evaluación</strong>
                  <small>Queda registrado que no se presentó y se le avisa la nueva fecha (a él y a su representante).</small>
                </label>
                <label class="opt-row" [class.on]="miss.mode === 'final'">
                  <input type="radio" name="mm" value="final" [(ngModel)]="miss.mode" />
                  <strong>No reprogramar</strong>
                  <small>Queda asentado que no se presentó. No podrá volver a pedir esta materia en este trimestre. No se puede deshacer.</small>
                </label>
              </fieldset>
              @if (miss.mode === 'reprogramar') {
                <div class="field"><label class="field-label" for="m-when">Nueva fecha y hora</label>
                  <input id="m-when" class="input" type="datetime-local" name="mwhen" [(ngModel)]="miss.when" required /></div>
                <div class="field"><label class="field-label" for="m-note">Nota para el estudiante (opcional)</label>
                  <textarea id="m-note" class="textarea" name="mnote" rows="2" maxlength="300" [(ngModel)]="miss.note"></textarea></div>
              }
            </div>
            <div class="dialog-actions">
              <button type="button" class="btn btn-text" (click)="missDlg.close()">Cancelar</button>
              <button type="submit" [class]="miss.mode === 'final' ? 'btn btn-danger' : 'btn btn-primary'"
                      [disabled]="saving() || !miss.mode || (miss.mode === 'reprogramar' && !miss.when)">
                {{ saving() ? 'Guardando…' : miss.mode === 'final' ? 'Confirmar: no se presentó' : 'Reprogramar y avisar' }}</button>
            </div>
          </form>
        }
      </dialog>
    } @else {
      <div class="skeleton" style="height: 320px; border-radius: 16px" role="status" aria-label="Cargando solicitud"></div>
    }
  `,
  styleUrl: './teacher-pages.scss',
  styles: `
    :host { display: grid; gap: 16px; }
    .back { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font: var(--label-lg); width: fit-content; }
    .lede { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .split { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 1000px) { .split { grid-template-columns: 1fr; } }
    .col { display: grid; gap: 16px; align-content: start; }
    .hicon { color: var(--on-surface-variant); font-size: 20px; }
    .section header .end { margin-left: auto; }
    .banner { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: var(--radius-md); background: #fff6d6; border: 1px solid #ecd27a; }
    .banner p { margin: 0; }
    .banner.muted-b { background: var(--surface-container-low); border-color: var(--outline-variant); }
    .when { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 10px 12px; border-radius: 8px; background: var(--primary-fixed); color: var(--on-primary-fixed); }
    .form { display: grid; gap: 14px; }
    .intro { margin: 0 0 14px; }
    .cur-note { display: flex; gap: 8px; align-items: flex-start; margin: -6px 0 14px; padding: 8px 12px; border-radius: 8px; background: #fff6d6; color: #4a3800; }
    .cur-note .material-symbols-outlined { font-size: 18px; margin-top: 2px; }
    .outcome { display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0 16px; }
    .edit { border-top: 1px solid var(--outline-variant); padding-top: 12px; }
    .edit summary { cursor: pointer; font: var(--label-lg); color: var(--primary-container); margin-bottom: 12px; }
    .result { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 10px; background: var(--success-container); color: var(--on-success-container); }
    .result.bad { background: var(--error-container); color: var(--on-error-container); }
    .result p { margin: 4px 0 0; }
    .miss { width: min(560px, calc(100vw - 32px)); }
    .dtitle { font: var(--title-lg); margin: 0; }
    .d-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; background: var(--error-container); color: var(--error); flex: none; }
    .dialog-head { display: flex; gap: 12px; align-items: center; }
    .opts { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
    .opts legend { margin-bottom: 6px; }
    .opt-row { display: grid; grid-template-columns: auto 1fr; column-gap: 10px; row-gap: 2px; align-items: center; padding: 10px 12px; border: 1px solid var(--outline-variant);
      border-radius: var(--radius-sm, 8px); cursor: pointer; }
    .opt-row small { grid-column: 2; color: var(--on-surface-variant); font: var(--body-md); font-size: 0.8125rem; }
    .opt-row.on { border-color: var(--primary-container); background: var(--surface-container-low); }
    .opt-row input { accent-color: var(--primary-container); width: 18px; height: 18px; }
    .field { display: grid; gap: 4px; }
    .notify { display: flex; gap: 8px; align-items: flex-start; margin: 4px 0 0; padding: 8px 10px; border-radius: 8px;
      background: var(--primary-fixed); color: var(--on-primary-fixed); font: var(--body-md); font-size: 0.8125rem; }
    .notify .material-symbols-outlined { font-size: 18px; margin-top: 1px; }
    .hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .hist li { padding-left: 14px; border-left: 2px solid var(--outline-variant); }
    .what { font: var(--label-lg); } .meta { font: var(--label-md); font-weight: 400; color: var(--on-surface-variant); }
    .note { margin-top: 4px; padding: 6px 10px; border-radius: 6px; background: var(--surface-container-low); font: var(--body-md); }
    .seen { display: flex; align-items: center; gap: 8px; margin: 14px 0 0; padding: 8px 10px; border-radius: 8px; background: #fff1c9; color: #5c4300; font: var(--label-md); font-weight: 400; }
    .seen.ok { background: var(--success-container); color: var(--on-success-container); }
    .seen .material-symbols-outlined { font-size: 18px; }
  `,
})
export class TeacherRequestPage {
  private readonly api = inject(TeacherApi);
  private readonly toast = inject(ToastService);
  readonly id = input.required<string>();
  readonly d = signal<TeacherItemDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly pdfBusy = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly labels = TRACK_LABELS;
  readonly status = STATUS_LABELS;
  readonly dt = fmtDateTime;
  readonly schedule = fmtSchedule;
  readonly hum = humanize;
  f = { scheduledAt: '', note: '' };
  miss: { mode: '' | 'reprogramar' | 'final'; when: string; note: string } = { mode: '', when: '', note: '' };
  readonly missOpen = signal(false);
  editOpen = false;
  private readonly confirm = inject(ConfirmService);
  private readonly missDlg = viewChild<ElementRef<HTMLDialogElement>>('missDlg');

  readonly closed = computed(() => CLOSED_REQUEST.has(this.d()?.requestStatus ?? ''));
  readonly final = computed(() => ['evaluado', 'no_asistio'].includes(this.d()?.track ?? ''));

  constructor() {
    effect(() => { const id = this.id(); void this.load(id); });
  }

  async openPdf(mode: 'ver' | 'imprimir') {
    const x = this.d();
    if (!x) return;
    this.pdfBusy.set(true);
    try {
      const blob = await this.api.pdf(x.id);
      if (mode === 'ver') viewBlob(blob); else printBlob(blob);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo abrir el PDF.')); }
    finally { this.pdfBusy.set(false); }
  }

  long(c: string) { return COURSE_LABELS_LONG[c] ?? c; }

  private reset(x: TeacherItemDetail) {
    this.f = { scheduledAt: x.scheduledAt ?? '', note: x.note ?? '' };
    this.editOpen = false;
  }

  async load(id: string) {
    this.error.set(null);
    try { const x = await this.api.item(id); this.d.set(x); this.reset(x); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos abrir la solicitud.')); }
  }

  changed(): boolean {
    const x = this.d();
    if (!x) return false;
    return x.track !== 'programada' || this.f.scheduledAt !== (x.scheduledAt ?? '') || this.f.note.trim() !== (x.note ?? '');
  }

  private async send(track: TrackStatus, extra: { scheduledAt?: string | null; note?: string | null; missed?: boolean }, ok: string) {
    const x = this.d();
    if (!x) return false;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.api.updateTrack([x.id], { track, scheduledAt: extra.scheduledAt ?? null, note: extra.note, missed: extra.missed });
      this.toast.ok(ok + (track === 'programada' && this.api.isDemo ? ' · vista previa: no se envió ningún aviso' : ''));
      await this.load(x.id);
      return true;
    } catch (e) {
      this.saveError.set(apiMessage(e, 'No se pudo guardar. Inténtalo de nuevo.'));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Programar o cambiar la fecha/nota. */
  schedule_() {
    const first = this.d()?.track !== 'programada';
    void this.send('programada', { scheduledAt: this.f.scheduledAt, note: this.f.note.trim() || null },
      first ? 'Evaluación programada · se avisó al estudiante y a su representante' : 'Cambios guardados');
  }

  async markEvaluated() {
    const x = this.d();
    if (!x) return;
    const ok = await this.confirm.ask({ title: '¿Confirmas que el estudiante sí rindió la evaluación?', tone: 'primary',
      confirmLabel: 'Sí, la rindió', risk: `${x.studentName} · ${x.subject}. Esta acción no se puede deshacer.` });
    if (ok === null) return;
    await this.send('evaluado', {}, 'Registrado: el estudiante rindió la evaluación');
  }

  openMissed() {
    this.miss = { mode: '', when: '', note: this.d()?.note ?? '' };
    this.missOpen.set(true);
    queueMicrotask(() => this.missDlg()?.nativeElement.showModal());
  }

  async confirmMissed() {
    const m = this.miss;
    const ok = m.mode === 'final'
      ? await this.send('no_asistio', {}, 'Registrado: el estudiante no se presentó')
      : await this.send('programada', { scheduledAt: m.when, note: m.note.trim() || null, missed: true },
        'Evaluación reprogramada · se avisó al estudiante y a su representante');
    if (ok) this.missDlg()?.nativeElement.close();
  }
}
