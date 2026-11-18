import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COURSE_LABELS_SHORT, PARALELOS } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { STATUS_LABELS, STATUS_ORDER, downloadBlob, fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows, StatusKey } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { Page, Period, ReqRow, SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-requests',
  imports: [FormsModule, RouterLink, Pager, EmptyState, SkeletonRows, StatusKey],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Todas las solicitudes</h1><p class="lede">Vista global con filtros. Desde el detalle puedes corregir estados, asignar responsables y fijar plazos.</p></div>
      <div class="actions">
        <button type="button" class="btn btn-outline" (click)="openBulk()" [disabled]="busy()"><span class="material-symbols-outlined" aria-hidden="true">event</span>Plazo masivo</button>
        <button type="button" class="btn btn-primary" (click)="export()" [disabled]="busy() || !page()?.total">
          <span class="material-symbols-outlined" aria-hidden="true">download</span>{{ exporting() ? 'Generando…' : 'Exportar Excel' }}</button>
      </div>
    </div>

    <div class="stages" role="group" aria-label="Filtrar por estado">
      @for (s of statuses; track s) {
        <button type="button" class="stage" [class.now]="s === actionStage()" [class.sel]="f.status === s" [style.--bar]="'var(--st-' + s + ')'" (click)="setStatus(s)" [attr.aria-pressed]="f.status === s">
          <span class="n">{{ page()?.byStatus?.[s] ?? '–' }}</span><app-status-key [status]="s" [label]="labels[s]" />
          <span class="cap">{{ f.status === s ? 'Filtrando' : s === actionStage() ? 'Requiere acción' : ' ' }}</span>
        </button>
      }
    </div>

    <form class="filters" (submit)="$event.preventDefault(); search()" role="search">
      <label class="field grow"><span class="field-label">Buscar</span>
        <input class="input" type="search" name="search" [(ngModel)]="f.search" placeholder="Número, estudiante, representante o cédula" /></label>
      <label class="field"><span class="field-label">Periodo</span>
        <select class="select" name="period" [(ngModel)]="f.periodKey" (ngModelChange)="search()"><option value="">Todos</option>
          @for (p of periods(); track p.key) { <option [value]="p.key">{{ p.trimestre }} · {{ p.aporte }}{{ p.isCurrent ? ' (vigente)' : '' }}</option> }</select></label>
      <label class="field"><span class="field-label">Curso</span>
        <select class="select" name="course" [(ngModel)]="f.course" (ngModelChange)="search()"><option value="">Todos</option>
          @for (c of courses; track c[0]) { <option [value]="c[0]">{{ c[1] }}</option> }</select></label>
      <label class="field"><span class="field-label">Paralelo</span>
        <select class="select" name="paralelo" [(ngModel)]="f.paralelo" (ngModelChange)="search()"><option value="">Todos</option>
          @for (p of paralelos; track p) { <option>{{ p }}</option> }</select></label>
      <label class="field"><span class="field-label">Plazo</span>
        <select class="select" name="due" [(ngModel)]="f.due" (ngModelChange)="search()"><option value="">Todos</option>
          <option value="overdue">Vencidas</option><option value="with">Con plazo</option><option value="without">Sin plazo</option></select></label>
      <label class="field"><span class="field-label">Desde</span><input class="input" type="date" name="from" [(ngModel)]="f.from" (change)="search()" /></label>
      <label class="field"><span class="field-label">Hasta</span><input class="input" type="date" name="to" [(ngModel)]="f.to" (change)="search()" /></label>
      @if (hasFilters()) { <button type="button" class="btn btn-text clear-all" (click)="clear()">Limpiar filtros</button> }
    </form>

    <div class="table-wrap">
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (loading() && !page()) { <app-skeleton-rows [cols]="7" /> }
      @else if (page()?.rows?.length) {
        <div class="table-scroll"><table class="dtable">
          <thead><tr><th>Número</th><th>Estudiante</th><th>Curso</th><th>Materias</th><th>Estado</th><th>Plazo</th><th>Responsable</th><th class="num">Recibida</th></tr></thead>
          <tbody>
            @for (r of page()!.rows; track r.id) {
              <tr class="clickable" (click)="open(r)">
                <td><a class="cell-link mono" [routerLink]="['/superadmin/solicitudes', r.id]" (click)="$event.stopPropagation()">{{ r.requestNumber }}</a>
                  @if (r.legacy) { <span class="sub">anterior al registro</span> }</td>
                <td><span class="strong">{{ r.studentName }}</span><span class="sub">{{ r.representativeName }}</span></td>
                <td class="nowrap">{{ courseShort[r.course] || r.course }} {{ r.paralelo }}</td>
                <td class="subj opt">{{ r.subjects.join(', ') }}</td>
                <td><app-status-key [status]="r.status" [label]="labels[r.status]" /></td>
                <td class="mono">@if (r.dueAt) { <span [class.overdue]="r.overdue">{{ dt(r.dueAt) }}</span> } @else { <span class="muted">—</span> }</td>
                <td class="opt">{{ r.assignedName ? 'Responsable: ' + r.assignedName : '' }}</td>
                <td class="num mono muted opt">{{ dt(r.createdAt) }}</td>
              </tr>
            }
          </tbody>
        </table></div>
        <app-pager [page]="page()!.page" [pageSize]="page()!.pageSize" [total]="page()!.total" [totalPages]="page()!.totalPages" (go)="go($event)" />
      } @else if (!loading()) {
        <app-empty icon="search_off" title="Ninguna solicitud coincide" text="Prueba con otro estado, periodo o rango de fechas.">
          @if (hasFilters()) { <button type="button" class="btn btn-outline btn-sm" (click)="clear()">Limpiar filtros</button> }
        </app-empty>
      }
    </div>

    <dialog #bulkDlg class="dialog" aria-labelledby="bd-title">
      <form (submit)="$event.preventDefault(); bulkDue()">
        <div class="dialog-head"><h2 id="bd-title">Plazo de atención masivo</h2></div>
        <div class="dialog-body">
          <p class="muted">Se aplica a las solicitudes pendientes y en revisión{{ f.periodKey ? ' del periodo filtrado' : ' de todos los periodos' }}. Cada una queda registrada en su historial.</p>
          <label class="field"><span class="field-label">Fecha y hora límite (hora de Ecuador)</span>
            <input class="input" type="datetime-local" name="due" [(ngModel)]="bulk.dueAt" />
            <span class="field-hint">Déjalo vacío para quitar el plazo.</span></label>
          <label class="check"><input type="checkbox" name="only" [(ngModel)]="bulk.onlyWithoutDue" /> Solo las que aún no tienen plazo</label>
          <label class="field"><span class="field-label">Motivo (mínimo 10 caracteres)</span>
            <textarea class="textarea" name="reason" [(ngModel)]="bulk.reason" rows="2" maxlength="500"></textarea></label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="bulkDlg.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="busy() || bulk.reason.trim().length < 10">Aplicar plazo</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .stages button.stage { border: 0; border-right: 1px solid var(--outline-variant); background: none; text-align: left; cursor: pointer; font: inherit; }
    .stages button.stage:last-child { border-right: 0; }
    .stages button.stage:hover { background: var(--surface-container-low); }
    .subj { max-width: 260px; color: var(--on-surface-variant); }
    .overdue { color: var(--error); font-weight: 650; }
    .overdue::before { content: 'Vencida · '; font-weight: 600; }
  `,
})
export class RequestsPage {
  private readonly api = inject(SaApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly status = input<string>();
  readonly due = input<string>();
  readonly searchQ = input<string>(undefined, { alias: 'search' });
  readonly statuses = STATUS_ORDER;
  readonly actionStage = () => {
    const b = this.page()?.byStatus;
    return b && (b['en_revision'] ?? 0) > (b['pendiente'] ?? 0) ? 'en_revision' : 'pendiente';
  };
  readonly labels = STATUS_LABELS;
  readonly courses = Object.entries(COURSE_LABELS_SHORT);
  readonly courseShort = COURSE_LABELS_SHORT;
  readonly paralelos = PARALELOS;
  readonly dt = fmtDateTime;
  f = { status: '', search: '', periodKey: '', course: '', paralelo: '', due: '', from: '', to: '' };
  readonly pageNo = signal(1);
  readonly page = signal<(Page<ReqRow> & { byStatus: Record<string, number> }) | null>(null);
  readonly periods = signal<Period[]>([]);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => {
      this.f.status = this.status() ?? '';
      this.f.due = this.due() ?? '';
      this.f.search = this.searchQ() ?? '';
      void this.load();
    });
    this.api.periods().then((p) => this.periods.set(p), () => undefined);
  }

  hasFilters() { return Object.values(this.f).some(Boolean); }
  private query() { return { ...this.f, search: this.f.search.trim(), page: this.pageNo(), pageSize: 25 }; }
  setStatus(s: string) { this.f.status = this.f.status === s ? '' : s; this.search(); }
  search() { this.pageNo.set(1); void this.load(); }
  go(p: number) { this.pageNo.set(p); void this.load(); }
  clear() { this.f = { status: '', search: '', periodKey: '', course: '', paralelo: '', due: '', from: '', to: '' }; this.search(); }
  open(r: ReqRow) { void this.router.navigate(['/superadmin/solicitudes', r.id]); }

  async load() {
    this.loading.set(true); this.error.set(null);
    try { this.page.set(await this.api.requests(this.query())); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar las solicitudes.')); }
    finally { this.loading.set(false); }
  }

  async export() {
    this.exporting.set(true); this.busy.set(true);
    try {
      const { page: _p, pageSize: _s, ...q } = this.query();
      const blob = await this.api.exportRequests(q);
      downloadBlob(blob, `solicitudes-${new Date().toISOString().slice(0, 10)}.xlsx`);
      this.toast.ok(`Exportadas ${this.page()?.total ?? ''} solicitudes`);
    } catch (e) { this.toast.error(apiMessage(e, 'No pudimos generar el Excel.')); }
    finally { this.exporting.set(false); this.busy.set(false); }
  }

  bulk = { dueAt: '', onlyWithoutDue: true, reason: '' };
  private readonly bulkDlg = viewChild.required<ElementRef<HTMLDialogElement>>('bulkDlg');
  openBulk() { this.bulk = { dueAt: '', onlyWithoutDue: true, reason: '' }; this.bulkDlg().nativeElement.showModal(); }

  async bulkDue() {
    this.busy.set(true);
    try {
      const r = await this.api.bulkDue({ requestType: 'proceso_mejora', periodKey: this.f.periodKey || null,
        dueAt: this.bulk.dueAt || null, onlyWithoutDue: this.bulk.onlyWithoutDue, reason: this.bulk.reason.trim() });
      this.bulkDlg().nativeElement.close();
      this.toast.ok(r.updated ? `Plazo aplicado a ${r.updated} solicitudes` : 'Ninguna solicitud activa coincide');
      void this.load();
    } catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }
}
