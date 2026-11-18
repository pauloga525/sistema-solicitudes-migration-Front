import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { ROLE_LABELS, STATUS_LABELS, fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { Dict, Page, SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-audit',
  imports: [FormsModule, RouterLink, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Auditoría</h1>
      <p class="lede">Registro de solo escritura: nadie puede editar ni borrar estos eventos. Los de cuentas se eliminan solos al cumplir el plazo de retención.</p></div></div>
    <div class="tabs" role="tablist">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'req'" (click)="switch('req')">Solicitudes</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'usr'" (click)="switch('usr')">Cuentas y configuración</button>
    </div>
    <form class="filters" (submit)="$event.preventDefault(); search()">
      @if (tab() === 'req') {
        <label class="field"><span class="field-label">Evento</span>
          <select class="select" name="et" [(ngModel)]="f.eventType" (ngModelChange)="search()"><option value="">Todos</option>
            @for (e of reqLabels(); track e[0]) { <option [value]="e[0]">{{ e[1] }}</option> }</select></label>
        <label class="field"><span class="field-label">Rol del actor</span>
          <select class="select" name="ar" [(ngModel)]="f.actorRole" (ngModelChange)="search()"><option value="">Todos</option>
            @for (r of roles; track r[0]) { <option [value]="r[0]">{{ r[1] }}</option> }</select></label>
        <label class="field"><span class="field-label">Número de solicitud</span><input class="input" name="rn" [(ngModel)]="f.requestNumber" placeholder="PM-2026-…" /></label>
      } @else {
        <label class="field"><span class="field-label">Evento</span>
          <select class="select" name="ue" [(ngModel)]="f.eventType" (ngModelChange)="search()"><option value="">Todos</option>
            @for (e of userLabels(); track e[0]) { <option [value]="e[0]">{{ e[1] }}</option> }</select></label>
        <label class="field"><span class="field-label">Resultado</span>
          <select class="select" name="res" [(ngModel)]="f.result" (ngModelChange)="search()"><option value="">Todos</option>
            <option value="SUCCESS">Correcto</option><option value="FAILURE">Fallido</option></select></label>
        <label class="field grow"><span class="field-label">Usuario o IP</span><input class="input" name="actor" [(ngModel)]="f.actor" placeholder="correo, usuario o IP" /></label>
      }
      <label class="field"><span class="field-label">Desde</span><input class="input" type="date" name="from" [(ngModel)]="f.from" (change)="search()" /></label>
      <label class="field"><span class="field-label">Hasta</span><input class="input" type="date" name="to" [(ngModel)]="f.to" (change)="search()" /></label>
      <button type="submit" class="btn btn-outline">Filtrar</button>
    </form>
    <div class="table-wrap">
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (loading() && !page()) { <app-skeleton-rows [cols]="5" /> }
      @else if (page()?.rows?.length) {
        <div class="table-scroll"><table class="dtable">
          @if (tab() === 'req') {
            <thead><tr><th>Fecha</th><th>Solicitud</th><th>Evento</th><th>Actor</th><th>Comentario</th></tr></thead>
            <tbody>
              @for (e of page()!.rows; track e['id']) {
                <tr>
                  <td class="mono nowrap">{{ dt(e['createdAt']) }}</td>
                  <td><a class="cell-link mono" [routerLink]="['/superadmin/solicitudes', e['requestId']]">{{ e['requestNumber'] || '—' }}</a></td>
                  <td>{{ e['eventLabel'] }}@if (e['toStatus']) { <span class="sub">@if (e['fromStatus']) { {{ st[$any(e['fromStatus'])] }} → } {{ st[$any(e['toStatus'])] }}</span> }</td>
                  <td>{{ e['actorName'] || 'Sistema' }}<span class="sub">{{ e['actorRoleLabel'] }}@if (e['actorIp']) { · {{ e['actorIp'] }} }</span></td>
                  <td class="cmt">{{ e['comment'] || '' }}</td>
                </tr>
              }
            </tbody>
          } @else {
            <thead><tr><th>Fecha</th><th>Evento</th><th>Quién</th><th>Sobre</th><th>Detalle</th></tr></thead>
            <tbody>
              @for (e of page()!.rows; track e['id']) {
                <tr>
                  <td class="mono nowrap">{{ dt(e['createdAt']) }}</td>
                  <td>{{ e['eventLabel'] }} @if (e['result'] === 'FAILURE') { <span class="tag bad">Fallido</span> }</td>
                  <td>{{ e['actorEmail'] || '—' }}<span class="sub">{{ roleLabel(e['actorRole']) }}@if (e['actorIp']) { · {{ e['actorIp'] }} }</span></td>
                  <td>{{ e['targetEmail'] || '' }}</td>
                  <td class="cmt">{{ meta(e['metadata']) }}</td>
                </tr>
              }
            </tbody>
          }
        </table></div>
        <app-pager [page]="page()!.page" [pageSize]="page()!.pageSize" [total]="page()!.total" [totalPages]="page()!.totalPages" (go)="go($event)" />
      } @else if (!loading()) { <app-empty icon="history" title="Sin eventos para estos filtros" /> }
    </div>
  `,
  styles: `.nowrap { white-space: nowrap; } .cmt { max-width: 320px; color: var(--on-surface-variant); overflow-wrap: anywhere; }`,
})
export class AuditPage {
  private readonly api = inject(SaApi);
  readonly tab = signal<'req' | 'usr'>('req');
  readonly page = signal<Page<Dict> | null>(null);
  readonly pageNo = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly reqLabels = signal<[string, string][]>([]);
  readonly userLabels = signal<[string, string][]>([]);
  readonly roles = Object.entries(ROLE_LABELS);
  readonly st = STATUS_LABELS;
  readonly dt = (v: unknown) => fmtDateTime(v as string);
  f = { eventType: '', actorRole: '', requestNumber: '', result: '', actor: '', from: '', to: '' };

  constructor() {
    this.api.labels().then((l) => { this.reqLabels.set(Object.entries(l.request)); this.userLabels.set(Object.entries(l.user)); }, () => undefined);
    void this.load();
  }
  roleLabel(r: unknown) { return ROLE_LABELS[String(r ?? '')] ?? ''; }
  meta(m: unknown): string {
    if (!m || typeof m !== 'object') return '';
    const o = m as Record<string, unknown>;
    const parts: string[] = [];
    if (o['from'] !== undefined || o['to']) parts.push(`${ROLE_LABELS[String(o['from'])] ?? '—'} → ${ROLE_LABELS[String(o['to'])] ?? o['to']}`);
    if (o['escalation']) parts.push('escalamiento');
    if (o['reason']) parts.push(String(o['reason']));
    if (o['rows'] !== undefined) parts.push(`${o['rows']} filas`);
    if (o['view']) parts.push(String(o['view']));
    return parts.join(' · ');
  }
  switch(t: 'req' | 'usr') { this.tab.set(t); this.f = { eventType: '', actorRole: '', requestNumber: '', result: '', actor: '', from: '', to: '' }; this.page.set(null); this.search(); }
  search() { this.pageNo.set(1); void this.load(); }
  go(p: number) { this.pageNo.set(p); void this.load(); }
  async load() {
    this.loading.set(true); this.error.set(null);
    try {
      const q = { ...this.f, page: this.pageNo() };
      this.page.set(this.tab() === 'req' ? await this.api.requestEvents(q) : await this.api.userEvents(q));
    } catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar la auditoría.')); }
    finally { this.loading.set(false); }
  }
}
