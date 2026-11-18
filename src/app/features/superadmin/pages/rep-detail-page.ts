import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { fmtDate } from '../../../shared/ui/format';
import { SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-rep-detail',
  imports: [FormsModule, RouterLink, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/superadmin/representantes" class="back"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Representantes</a>
    @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
    @if (d(); as x) {
      <div class="page-head"><div><h1>{{ x.names }}</h1><p class="lede">Cédula {{ x.cedula }} @if (!x.isActive) { · <span class="tag bad">Inactivo</span> }</p></div>
        <div class="actions"><a class="btn btn-outline btn-sm" routerLink="/superadmin/solicitudes" [queryParams]="{ search: x.cedula }">Solicitudes donde figura</a></div></div>
      <div class="split">
        <section class="section"><header><h2>Estudiantes a cargo</h2></header>
          <table class="dtable">
            <thead><tr><th>Estudiante</th><th>Parentesco</th><th>Vínculo</th><th class="num">Desde</th></tr></thead>
            <tbody>
              @for (l of x.links; track l.linkId) {
                <tr [class.off]="!l.active">
                  <td><a class="cell-link" [routerLink]="['/superadmin/estudiantes', l.studentUserId]">{{ l.studentName || l.studentEmail }}</a>
                    @if (!l.studentActive) { <span class="tag bad">Cuenta desactivada</span> }</td>
                  <td>{{ l.relationship }}</td>
                  <td>@if (!l.active) { <span class="tag">Desvinculado {{ date(l.unlinkedAt) }}</span> } @else if (l.isPrimary) { <span class="tag gold">Principal</span> } @else { <span class="tag">Secundario</span> }</td>
                  <td class="num muted">{{ date(l.linkedAt) }}</td>
                </tr>
              } @empty { <tr><td colspan="4" class="muted">No tiene estudiantes vinculados.</td></tr> }
            </tbody>
          </table>
        </section>
        <section class="section"><header><h2>Datos de contacto</h2></header>
          <form class="body form-grid one" (submit)="$event.preventDefault(); save()">
            <label class="field"><span class="field-label">Nombres</span><input class="input" name="n" [(ngModel)]="e.names" /></label>
            <label class="field"><span class="field-label">Teléfono</span><input class="input" name="p" [(ngModel)]="e.phone" maxlength="10" /></label>
            <label class="field"><span class="field-label">Correo</span><input class="input" name="m" type="email" [(ngModel)]="e.email" /></label>
            <label class="check"><input type="checkbox" name="a" [(ngModel)]="e.isActive" /> Representante activo</label>
            <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit" [disabled]="busy()">Guardar</button></div>
          </form>
        </section>
      </div>
    } @else if (!error()) { <app-skeleton-rows [rows]="6" [cols]="3" /> }
  `,
  styles: `.back { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font: var(--label-lg); width: fit-content; }
    .one { grid-template-columns: 1fr; } tr.off td { color: var(--on-surface-variant); }`,
})
export class RepDetailPage {
  private readonly api = inject(SaApi);
  private readonly toast = inject(ToastService);
  readonly id = input.required<string>();
  readonly d = signal<any>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly date = fmtDate;
  e = { names: '', phone: '', email: '', isActive: true };
  constructor() { queueMicrotask(() => void this.load()); }
  async load() {
    try {
      const x: any = await this.api.rep(this.id());
      this.d.set(x);
      this.e = { names: x.names ?? '', phone: x.phone ?? '', email: x.email ?? '', isActive: x.isActive };
    } catch (err) { this.error.set(apiMessage(err, 'No pudimos cargar la ficha.')); }
  }
  async save() {
    this.busy.set(true);
    try {
      const b: Record<string, unknown> = { names: this.e.names.trim(), phone: this.e.phone.trim(), isActive: this.e.isActive };
      if (this.e.email.trim()) b['email'] = this.e.email.trim();
      await this.api.editRep(this.id(), b);
      this.toast.ok('Datos guardados');
      await this.load();
    } catch (err) { this.toast.error(apiMessage(err)); } finally { this.busy.set(false); }
  }
}
