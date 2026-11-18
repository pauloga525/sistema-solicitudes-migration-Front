import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { fmtDate } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { Dict, Page, SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-reps',
  imports: [FormsModule, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Representantes</h1>
      <p class="lede">Padres, madres y tutores registrados por los estudiantes. Una misma persona se guarda una sola vez aunque represente a varios.</p></div></div>
    <form class="filters" (submit)="$event.preventDefault(); search()" role="search">
      <label class="field grow"><span class="field-label">Buscar</span><input class="input" type="search" name="q" [(ngModel)]="q" placeholder="Nombre o cédula exacta" /></label>
      <label class="field"><span class="field-label">Vínculos</span>
        <select class="select" name="linked" [(ngModel)]="linked" (ngModelChange)="search()"><option value="">Todos</option>
          <option value="none">Sin estudiantes</option><option value="multiple">Con varios estudiantes</option></select></label>
      <button type="submit" class="btn btn-outline">Buscar</button>
    </form>
    <div class="table-wrap">
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (loading() && !page()) { <app-skeleton-rows [cols]="5" /> }
      @else if (page()?.rows?.length) {
        <div class="table-scroll"><table class="dtable">
          <thead><tr><th>Representante</th><th>Cédula</th><th>Teléfono</th><th class="num">Estudiantes</th><th class="num">Registrado</th></tr></thead>
          <tbody>
            @for (r of page()!.rows; track r['id']) {
              <tr class="clickable" tabindex="0" (click)="open(r)" (keydown.enter)="open(r)">
                <td><span class="strong">{{ r['name'] }}</span>@if (!r['isActive']) { <span class="tag bad">Inactivo</span> }</td>
                <td class="mono">{{ r['cedula'] }}</td><td class="mono">{{ r['phone'] || '—' }}</td>
                <td class="num">@if (r['students']) { {{ r['students'] }} } @else { <span class="tag warn">0</span> }</td>
                <td class="num muted">{{ date($any(r['createdAt'])) }}</td>
              </tr>
            }
          </tbody>
        </table></div>
        <app-pager [page]="page()!.page" [pageSize]="page()!.pageSize" [total]="page()!.total" [totalPages]="page()!.totalPages" (go)="go($event)" />
      } @else if (!loading()) { <app-empty icon="family_restroom" title="No hay representantes con esos filtros" /> }
    </div>
  `,
})
export class RepsPage {
  private readonly api = inject(SaApi);
  private readonly router = inject(Router);
  readonly date = fmtDate;
  q = ''; linked = '';
  readonly pageNo = signal(1);
  readonly page = signal<Page<Dict> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  constructor() { void this.load(); }
  search() { this.pageNo.set(1); void this.load(); }
  go(p: number) { this.pageNo.set(p); void this.load(); }
  open(r: Dict) { void this.router.navigate(['/superadmin/representantes', r['id']]); }
  async load() {
    this.loading.set(true); this.error.set(null);
    try { this.page.set(await this.api.reps({ q: this.q.trim(), linked: this.linked, page: this.pageNo() })); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar los representantes.')); }
    finally { this.loading.set(false); }
  }
}
