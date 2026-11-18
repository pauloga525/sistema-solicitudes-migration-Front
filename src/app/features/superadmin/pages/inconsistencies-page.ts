import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-inconsistencies',
  imports: [RouterLink, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Inconsistencias</h1>
      <p class="lede">Datos que conviene revisar: estudiantes sin representante, vínculos con cuentas inactivas, cédulas fuera del padrón.</p></div>
      <div class="actions"><button type="button" class="btn btn-outline btn-sm" (click)="load()">Volver a revisar</button></div></div>
    @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
    @if (d(); as x) {
      @if (x.total === 0) {
        <div class="section"><app-empty icon="task_alt" title="Todo en orden" text="No encontramos datos inconsistentes en estudiantes, representantes ni vínculos." /></div>
      }
      <p class="muted">Solicitudes anteriores al registro de estudiantes: {{ x.legacyRequests }} · Solicitudes con plazo vencido: {{ x.overdueRequests }}</p>
      @for (g of x.groups; track g.key) {
        @if (g.rows.length) {
          <section class="section">
            <header><h2>{{ g.label }}</h2><span class="end"><span class="tag warn">{{ g.rows.length }}</span></span></header>
            <table class="dtable">
              <tbody>
                @for (r of g.rows; track $index) {
                  <tr>
                    <td>
                      @if (g.key === 'orphan_reps') { <a class="cell-link" [routerLink]="['/superadmin/representantes', r.id]">{{ r.name }}</a> }
                      @else { <a class="cell-link" [routerLink]="['/superadmin/estudiantes', r.studentUserId || r.id]">{{ r.name || r.email || 'Sin nombre' }}</a>
                        @if (r.email) { <span class="sub">{{ r.email }}</span> } }
                    </td>
                    <td class="muted">{{ r.note }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      }
    } @else if (!error()) { <app-skeleton-rows [rows]="6" [cols]="2" /> }
  `,
})
export class InconsistenciesPage {
  private readonly api = inject(SaApi);
  readonly d = signal<any>(null);
  readonly error = signal<string | null>(null);
  constructor() { void this.load(); }
  async load() {
    this.error.set(null);
    try { this.d.set(await this.api.inconsistencies()); } catch (e) { this.error.set(apiMessage(e, 'No pudimos revisar los datos.')); }
  }
}
