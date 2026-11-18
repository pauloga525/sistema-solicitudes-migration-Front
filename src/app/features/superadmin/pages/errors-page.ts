import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiMessage } from '../../../core/utils/errors';
import { fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { Dict, Page, SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-errors',
  imports: [FormsModule, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Errores del sistema</h1>
      <p class="lede">Fallos no controlados del servidor. La traza solo se ve aquí: al navegador del usuario nunca llega. Se conservan 6 meses.</p></div></div>
    @if (page(); as p) {
      <dl class="mini">
        <div><dt>Sin resolver</dt><dd [class.bad]="p.stats['unresolved']">{{ p.stats['unresolved'] }}</dd></div>
        <div><dt>Errores abiertos</dt><dd>{{ p.stats['errors'] }}</dd></div>
        <div><dt>Advertencias abiertas</dt><dd>{{ p.stats['warnings'] }}</dd></div>
        <div><dt>Total registrado</dt><dd>{{ p.stats['total'] }}</dd></div>
      </dl>
    }
    <form class="filters" (submit)="$event.preventDefault(); search()">
      <label class="field"><span class="field-label">Estado</span>
        <select class="select" name="r" [(ngModel)]="f.resolved" (ngModelChange)="search()"><option value="">Todos</option><option value="false">Sin resolver</option><option value="true">Resueltos</option></select></label>
      <label class="field"><span class="field-label">Nivel</span>
        <select class="select" name="l" [(ngModel)]="f.level" (ngModelChange)="search()"><option value="">Todos</option><option value="ERROR">Error</option><option value="WARN">Advertencia</option></select></label>
      <label class="field grow"><span class="field-label">Origen</span><input class="input" name="s" [(ngModel)]="f.source" placeholder="Ruta, p. ej. /superadmin" /></label>
      <label class="field"><span class="field-label">Desde</span><input class="input" type="date" name="from" [(ngModel)]="f.from" (change)="search()" /></label>
      <label class="field"><span class="field-label">Hasta</span><input class="input" type="date" name="to" [(ngModel)]="f.to" (change)="search()" /></label>
      <button type="submit" class="btn btn-outline">Filtrar</button>
    </form>
    <div class="table-wrap">
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (loading() && !page()) { <app-skeleton-rows [cols]="4" /> }
      @else if (page()?.rows?.length) {
        <div class="table-scroll"><table class="dtable">
          <thead><tr><th>Fecha</th><th>Nivel</th><th>Origen</th><th>Mensaje</th><th>Estado</th></tr></thead>
          <tbody>
            @for (e of page()!.rows; track e['id']) {
              <tr class="clickable" tabindex="0" (click)="open(e)" (keydown.enter)="open(e)">
                <td class="mono">{{ dt(e['createdAt']) }}</td>
                <td>@if (e['level'] === 'ERROR') { <span class="tag bad">Error</span> } @else { <span class="tag warn">Advertencia</span> }</td>
                <td class="mono">{{ e['source'] }}</td><td class="msg">{{ e['message'] }}</td>
                <td>@if (e['resolved']) { <span class="tag ok">Resuelto</span> } @else { <span class="tag">Abierto</span> }</td>
              </tr>
            }
          </tbody>
        </table></div>
        <app-pager [page]="page()!.page" [pageSize]="25" [total]="page()!.total" [totalPages]="page()!.totalPages" (go)="go($event)" />
      } @else if (!loading()) { <app-empty icon="verified" title="Sin errores registrados" text="Cuando el servidor tenga un fallo inesperado, aparecerá aquí con su traza." /> }
    </div>
    <dialog #dlg class="sheet" aria-labelledby="er-title" (close)="sel.set(null)">
      @if (sel(); as e) {
        <div class="sheet-head"><h2 id="er-title">Detalle del error</h2>
          <button type="button" class="icon-btn" (click)="dlg.close()" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button></div>
        <div class="sheet-body">
          <dl class="kv">
            <dt>Fecha</dt><dd>{{ dt(e['createdAt']) }}</dd><dt>Origen</dt><dd class="mono">{{ e['method'] }} {{ e['path'] }}</dd>
            <dt>Usuario</dt><dd class="mono">{{ e['userId'] || 'Sin sesión' }}</dd><dt>Mensaje</dt><dd>{{ e['message'] }}</dd>
            @if (e['resolved']) { <dt>Resuelto</dt><dd>{{ dt(e['resolvedAt']) }}@if (e['resolveNote']) { · {{ e['resolveNote'] }} }</dd> }
          </dl>
          @if (e['stack']) { <pre class="stack">{{ e['stack'] }}</pre> }
          @if (e['resolved']) {
            <div class="form-actions"><button type="button" class="btn btn-outline" (click)="reopen(e)" [disabled]="busy()">Reabrir</button></div>
          } @else {
            <label class="field"><span class="field-label">Nota de resolución (opcional)</span><textarea class="textarea" rows="2" [(ngModel)]="note" maxlength="500"></textarea></label>
            <div class="form-actions"><button type="button" class="btn btn-primary" (click)="resolve(e)" [disabled]="busy()">Marcar como resuelto</button></div>
          }
        </div>
      }
    </dialog>
  `,
  styles: `
    .mini { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; margin: 0; border: 1px solid var(--outline-variant); border-radius: var(--radius-md); background: var(--surface-container-lowest); overflow: hidden; }
    .mini div { padding: 12px 16px; border-right: 1px solid var(--outline-variant); } .mini div:last-child { border-right: 0; }
    .mini dt { font: var(--label-md); color: var(--on-surface-variant); } .mini dd { margin: 4px 0 0; font: 650 1.375rem/1.1 var(--font-sans); font-variant-numeric: tabular-nums; }
    .mini dd.bad { color: var(--error); }
    .msg { max-width: 420px; overflow-wrap: anywhere; }
    .stack { margin: 0; padding: 12px; background: var(--inverse-surface); color: #dfe7f3; border-radius: 8px; font: 0.75rem/1.5 ui-monospace, 'SFMono-Regular', Consolas, monospace; overflow: auto; max-height: 50vh; white-space: pre; }
  `,
})
export class ErrorsPage {
  private readonly api = inject(SaApi);
  private readonly toast = inject(ToastService);
  readonly page = signal<(Page<Dict> & { stats: Dict }) | null>(null);
  readonly pageNo = signal(1);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sel = signal<Dict | null>(null);
  readonly dt = (v: unknown) => fmtDateTime(v as string);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  f = { resolved: 'false', level: '', source: '', from: '', to: '' };
  note = '';
  constructor() { void this.load(); }
  search() { this.pageNo.set(1); void this.load(); }
  go(p: number) { this.pageNo.set(p); void this.load(); }
  async load() {
    this.loading.set(true); this.error.set(null);
    try { this.page.set(await this.api.errors({ ...this.f, page: this.pageNo() })); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar los errores.')); }
    finally { this.loading.set(false); }
  }
  async open(e: Dict) {
    this.note = '';
    this.sel.set(e);
    this.dlg().nativeElement.showModal();
    try { this.sel.set(await this.api.error(String(e['id']))); } catch (err) { this.toast.error(apiMessage(err)); }
  }
  async resolve(e: Dict) {
    this.busy.set(true);
    try { this.sel.set(await this.api.resolveError(String(e['id']), this.note.trim())); this.toast.ok('Marcado como resuelto'); void this.load(); }
    catch (err) { this.toast.error(apiMessage(err)); } finally { this.busy.set(false); }
  }
  async reopen(e: Dict) {
    this.busy.set(true);
    try { this.sel.set(await this.api.reopenError(String(e['id']))); this.toast.ok('Error reabierto'); void this.load(); }
    catch (err) { this.toast.error(apiMessage(err)); } finally { this.busy.set(false); }
  }
}
