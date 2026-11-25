import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { COURSE_CODES, COURSE_LABELS_SHORT, PARALELOS, SUBJECTS_PERMITIDOS } from '../../../core/catalogs';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiMessage } from '../../../core/utils/errors';
import { downloadBlob, fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { fmtLocal } from '../activacion/activacion-page';
import { AdminLayout } from '../shell/admin-layout';
import { ESTADO_TAG } from './expediente';
import { EvalEstado, EvalFilters, EvalPage, EvalRow, MAIL_LABELS, SeguimientoApi } from './seguimiento-api';

const STAGES: { key: EvalEstado | 'atrasadas'; label: string; cap: string }[] = [
  { key: 'por_atender', label: 'Por atender', cap: 'El docente aún no programa' },
  { key: 'atrasadas', label: 'Atrasadas', cap: 'Más de 3 días sin atender' },
  { key: 'sin_docente', label: 'Sin docente', cap: 'Materia sin docente asignado' },
  { key: 'programada', label: 'Programadas', cap: 'Con fecha y hora' },
  { key: 'vencida', label: 'Fecha pasada', cap: 'Sin registrar si se tomó' },
  { key: 'evaluado', label: 'Evaluadas', cap: 'El estudiante rindió' },
  { key: 'no_asistio', label: 'No se presentó', cap: 'Registrado por el docente' },
];

/**
 * Seguimiento de evaluaciones (vicerrectorado): cada materia de cada solicitud con su docente, lo que registró y
 * si se avisó al docente y al estudiante. Solo lectura.
 */
@Component({
  selector: 'app-seguimiento-page',
  imports: [AdminLayout, FormsModule, RouterLink, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-layout title="Seguimiento de evaluaciones"
                      lede="Cada materia solicitada, el docente al que se asignó, si programó y tomó la evaluación, y la constancia de los avisos enviados al docente, al estudiante y a su representante.">
      <button layoutActions type="button" class="btn btn-outline" (click)="exportCsv()" [disabled]="exporting() || !data()?.total">
        <span class="material-symbols-outlined" [class.spin]="exporting()" aria-hidden="true">{{ exporting() ? 'progress_activity' : 'download' }}</span>
        {{ exporting() ? 'Generando…' : 'Exportar CSV' }}</button>

      <div class="stages seven" role="group" aria-label="Materias por estado del seguimiento (clic para filtrar)">
        @for (st of stages; track st.key) {
          <button type="button" class="stage" [class.sel]="f.estado === st.key" [class.alert]="isAlert(st.key)"
                  [attr.aria-pressed]="f.estado === st.key" (click)="pick(st.key)">
            @if (data(); as d) { <span class="n tnum">{{ d.totals[st.key] ?? 0 }}</span> } @else { <span class="skeleton" style="height:28px;width:40px"></span> }
            <span class="lbl">{{ st.label }}</span>
            <span class="cap">{{ f.estado === st.key ? 'Filtrando · quitar' : st.cap }}</span>
          </button>
        }
      </div>

      <form class="filters" (submit)="$event.preventDefault(); search(1)" role="search" aria-label="Filtros">
        <div class="field grow"><label class="field-label" for="s-q">Estudiante o número</label>
          <input id="s-q" class="input" type="search" name="q" [(ngModel)]="f.q" placeholder="Ej.: Pérez o PM-2026-0012" /></div>
        <div class="field"><label class="field-label" for="s-c">Curso</label>
          <select id="s-c" class="select" name="c" [(ngModel)]="f.course" (ngModelChange)="f.subject = ''; search(1)">
            <option value="">Todos</option>
            @for (c of courses; track c) { <option [value]="c">{{ courseLabels[c] ?? c }}</option> }
          </select></div>
        <div class="field"><label class="field-label" for="s-p">Paralelo</label>
          <select id="s-p" class="select" name="p" [(ngModel)]="f.paralelo" (ngModelChange)="search(1)">
            <option value="">Todos</option>
            @for (p of paralelos; track p) { <option [value]="p">{{ p }}</option> }
          </select></div>
        <div class="field"><label class="field-label" for="s-m">Materia</label>
          <select id="s-m" class="select" name="m" [(ngModel)]="f.subject" (ngModelChange)="search(1)">
            <option value="">Todas</option>
            @for (s of subjects(); track s) { <option [value]="s">{{ s }}</option> }
          </select></div>
        <div class="field"><label class="field-label" for="s-t">Docente</label>
          <input id="s-t" class="input" type="search" name="t" [(ngModel)]="f.teacher" placeholder="Nombre del docente" /></div>
        <div class="field"><label class="field-label" for="s-e">Seguimiento</label>
          <select id="s-e" class="select" name="e" [(ngModel)]="f.estado" (ngModelChange)="search(1)">
            <option value="">Todos</option>
            <option value="abiertas">Pendientes de evaluar</option>
            @for (st of stages; track st.key) { <option [value]="st.key">{{ st.label }}</option> }
            <option value="no_requiere">No requiere (cancelada o rechazada)</option>
          </select></div>
        <div class="factions">
          <button type="submit" class="btn btn-primary btn-sm">Buscar</button>
          @if (hasFilters()) { <button type="button" class="btn btn-text btn-sm" (click)="clear()">Limpiar</button> }
        </div>
      </form>

      @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }

      <div class="table-wrap">
        @if (loading() && !data()) { <app-skeleton-rows [rows]="6" [cols]="6" /> }
        @else if (data()?.rows?.length) {
          <p class="count muted tnum">{{ data()!.total }} {{ data()!.total === 1 ? 'materia' : 'materias' }}</p>
          <div class="table-scroll">
            <table class="dtable">
              <thead><tr><th>Estudiante</th><th>Materia</th><th>Docente</th><th>Seguimiento</th><th>Avisos</th><th class="act"><span class="sr-only">Abrir</span></th></tr></thead>
              <tbody>
                @for (r of data()!.rows; track r.requestId + r.subject) {
                  <tr [class.closed]="r.estado === 'no_requiere'">
                    <td><a class="strong" [routerLink]="['/admin/solicitudes', r.requestId]" fragment="seguimiento">{{ r.studentName }}</a>
                      @if (r.isTest) { <span class="tag warn" title="Solicitud de una cuenta de prueba">Prueba</span> }
                      <span class="sub">{{ r.courseLabel }} {{ r.paralelo }} · <span class="mono">{{ r.requestNumber }}</span> · {{ ago(r.submittedAt) }}</span></td>
                    <td>{{ r.subject }}</td>
                    <td>@if (r.teachers.length) { {{ r.teachers.join(', ') }} } @else { <span class="bad-text">Sin docente</span> }</td>
                    <td><span class="tag" [class]="'tag ' + tag[r.estado]">{{ r.estadoLabel }}</span>
                      @if (r.late) { <span class="tag bad">+3 días</span> }
                      @if (r.scheduledAt) { <span class="sub tnum">{{ r.estado === 'evaluado' || r.estado === 'no_asistio' ? 'Programada: ' : '' }}{{ local(r.scheduledAt) }}</span> }
                      @if (r.doneAt) { <span class="sub tnum">Registrado {{ dt(r.doneAt) }}</span> }</td>
                    <td class="nt">
                      <span class="ic" [class]="'ic ' + noteCls(r.teacherNotified, r.teacherRead)" [attr.title]="'Docente · aviso: ' + noteText(r.teacherNotified, r.teacherRead) + ' · ' + mail(r.teacherMail)">
                        <span class="material-symbols-outlined" aria-hidden="true">co_present</span>
                        <span class="sr-only">Docente: {{ noteText(r.teacherNotified, r.teacherRead) }}, {{ mail(r.teacherMail) }}</span></span>
                      <span class="ic" [class]="'ic ' + noteCls(r.studentNotified, r.studentRead, r.scheduledAt !== null)" [attr.title]="'Estudiante · aviso: ' + noteText(r.studentNotified, r.studentRead) + ' · ' + mail(r.studentMail)">
                        <span class="material-symbols-outlined" aria-hidden="true">school</span>
                        <span class="sr-only">Estudiante: {{ noteText(r.studentNotified, r.studentRead) }}, {{ mail(r.studentMail) }}</span></span>
                    </td>
                    <td class="act"><a class="btn btn-text btn-sm" [routerLink]="['/admin/solicitudes', r.requestId]" fragment="seguimiento">Ver expediente</a></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [page]="data()!.page" [pageSize]="data()!.pageSize" [total]="data()!.total" [totalPages]="data()!.totalPages" (go)="search($event)" />
          <p class="legend muted"><span class="ic ok"><span class="material-symbols-outlined" aria-hidden="true">co_present</span></span> aviso leído
            <span class="ic sent"><span class="material-symbols-outlined" aria-hidden="true">co_present</span></span> aviso enviado, sin leer
            <span class="ic none"><span class="material-symbols-outlined" aria-hidden="true">co_present</span></span> sin aviso.
            Pasa el cursor sobre cada ícono para ver el estado del correo.</p>
        } @else if (!loading()) {
          <app-empty icon="fact_check" [title]="hasFilters() ? 'No hay materias con esos filtros' : 'Aún no hay solicitudes'"
                     [text]="hasFilters() ? 'Cambia o limpia los filtros.' : 'Cuando los estudiantes envíen solicitudes, aquí verás el seguimiento de cada materia.'" />
        }
      </div>
    </app-admin-layout>
  `,
  styles: `
    .stages.seven { grid-template-columns: repeat(7, minmax(0, 1fr)); }
    @media (max-width: 1100px) { .stages.seven { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .stages.seven { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .stage { border: 0; border-right: 1px solid var(--outline-variant); background: var(--surface-container-lowest); text-align: left; cursor: pointer;
      font: inherit; color: inherit; display: grid; gap: 2px; align-content: start; }
    .stage:last-child { border-right: 0; }
    .stage:hover { background: var(--surface-container-low); }
    .stage.sel { background: var(--primary-fixed); box-shadow: inset 0 -3px 0 var(--primary-container); }
    .stage .lbl { font: var(--label-lg); }
    .stage .cap { font: var(--label-md); font-weight: 400; color: var(--on-surface-variant); }
    .stage.alert .n { color: var(--error); }
    .factions { display: flex; align-items: flex-end; gap: 6px; }
    .count { margin: 0 0 8px; padding: 12px 14px 0; }
    .act { text-align: right; white-space: nowrap; }
    tr.closed td { color: var(--on-surface-variant); }
    .tag + .tag { margin-left: 6px; }
    .bad-text { color: var(--error); font-weight: 600; }
    .nt { white-space: nowrap; }
    .ic { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; margin-right: 4px; vertical-align: middle; }
    .ic .material-symbols-outlined { font-size: 17px; }
    .ic.ok { background: var(--success-container); color: var(--on-success-container); }
    .ic.sent { background: #fff1c9; color: #5c4300; }
    .ic.none { background: var(--surface-container-high); color: var(--outline); }
    .ic.na { background: transparent; color: var(--outline-variant); }
    .legend { padding: 8px 14px 14px; font: var(--label-md); font-weight: 400; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .legend .ic { width: 22px; height: 22px; margin: 0 2px 0 8px; }
    .legend .ic:first-child { margin-left: 0; }
    .legend .ic .material-symbols-outlined { font-size: 14px; }
  `,
})
export class SeguimientoPage {
  private readonly api = inject(SeguimientoApi);
  private readonly admin = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  readonly stages = STAGES;
  readonly courses = COURSE_CODES;
  readonly courseLabels = COURSE_LABELS_SHORT;
  readonly paralelos = PARALELOS;
  readonly tag = ESTADO_TAG;
  readonly dt = fmtDateTime;
  readonly ago = fmtAgo;
  readonly local = fmtLocal;
  readonly data = signal<EvalPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  private readonly curriculum = signal<{ byCourse: Record<string, string[]> } | null>(null);
  f: Required<Omit<EvalFilters, 'page'>> = { estado: '', course: '', paralelo: '', subject: '', teacher: '', q: '' };

  constructor() {
    void this.search(1);
    this.admin.getCurriculum('proceso_mejora').then((c) => this.curriculum.set(c), () => undefined);
  }

  subjects(): string[] {
    const c = this.curriculum();
    if (!c) return [...SUBJECTS_PERMITIDOS];
    return this.f.course ? (c.byCourse[this.f.course] ?? [])
      : [...new Set(Object.values(c.byCourse).flat())].sort((a, b) => a.localeCompare(b, 'es'));
  }
  hasFilters() { return Object.values(this.f).some((v) => v); }
  isAlert(k: string) { return ['atrasadas', 'sin_docente', 'vencida'].includes(k) && (this.data()?.totals[k as EvalEstado] ?? 0) > 0; }

  async search(page: number) {
    this.loading.set(true);
    this.error.set(null);
    try { this.data.set(await this.api.list({ ...this.f, page })); }
    catch (e) { this.error.set(apiMessage(e, 'No se pudo cargar el seguimiento.')); }
    finally { this.loading.set(false); }
  }
  pick(k: string) { this.f.estado = this.f.estado === k ? '' : k; void this.search(1); }
  clear() { this.f = { estado: '', course: '', paralelo: '', subject: '', teacher: '', q: '' }; void this.search(1); }

  noteCls(sent: boolean, read: boolean, expected = true) { return !expected && !sent ? 'na' : read ? 'ok' : sent ? 'sent' : 'none'; }
  noteText(sent: boolean, read: boolean) { return read ? 'leído' : sent ? 'enviado, sin leer' : 'sin aviso'; }
  mail(s: EvalRow['teacherMail']) { return s ? MAIL_LABELS[s] : 'sin correo'; }

  async exportCsv() {
    this.exporting.set(true);
    try {
      downloadBlob(await this.api.exportCsv(this.f), `seguimiento-evaluaciones-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo exportar.')); }
    finally { this.exporting.set(false); }
  }
}
