import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiMessage } from '../../../core/utils/errors';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { AccessRequest, Page, SaApi } from '../sa-api.service';

const STATUS_LABEL: Record<AccessRequest['status'], string> = { pending: 'Pendiente', granted: 'Acceso dado', dismissed: 'Descartada' };

/**
 * Docentes y personal administrativo (correo sin ".est") que intentaron ingresar. No tienen cuenta:
 * el SUPERADMIN decide si les da el rol de administrador para revisar las solicitudes.
 */
@Component({
  selector: 'app-sa-access',
  imports: [FormsModule, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Solicitudes de acceso</h1>
      <p class="lede">Docentes y personal administrativo que intentaron ingresar con su cuenta institucional. Aún no tienen acceso:
        dales el rol de administrador si deben revisar las solicitudes de los estudiantes.</p></div></div>

    <form class="filters" (submit)="$event.preventDefault(); search()" role="search">
      <div class="field grow"><label class="field-label" for="ar-q">Buscar</label>
        <input id="ar-q" class="input" type="search" name="q" [(ngModel)]="q" placeholder="Nombre o correo" /></div>
      <div class="field"><label class="field-label" for="ar-st">Estado</label>
        <select id="ar-st" class="select" name="status" [(ngModel)]="status" (ngModelChange)="search()">
          <option value="pending">Pendientes</option><option value="granted">Con acceso</option>
          <option value="dismissed">Descartadas</option><option value="all">Todas</option>
        </select></div>
    </form>

    @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }
    @if (data(); as d) {
      @if (d.rows.length) {
        <section class="section">
          <table class="dtable">
            <thead><tr><th>Persona</th><th>Intentos</th><th>Último intento</th><th>Estado</th><th class="opt"><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              @for (r of d.rows; track r.id) {
                <tr>
                  <td><strong>{{ r.name || '(sin nombre)' }}</strong><span class="sub">{{ r.email }}</span></td>
                  <td class="tnum">{{ r.attempts }}</td>
                  <td [title]="fmtDateTime(r.lastSeenAt)">{{ fmtAgo(r.lastSeenAt) }}</td>
                  <td><span class="tag" [class.warn]="r.status === 'pending'" [class.ok]="r.status === 'granted'">{{ label(r) }}</span></td>
                  <td class="opt">
                    @if (r.status === 'pending') {
                      <div class="row-actions">
                        <button type="button" class="btn btn-primary btn-sm" (click)="grant(r)" [disabled]="busy()">Dar acceso de administrador…</button>
                        <button type="button" class="btn btn-text btn-sm" (click)="dismiss(r)" [disabled]="busy()">Descartar</button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        @if (d.totalPages > 1) { <app-pager [page]="d.page" [pageSize]="d.pageSize" [total]="d.total" [totalPages]="d.totalPages" (go)="load($event)" /> }
      } @else {
        <div class="section"><app-empty icon="person_add"
          [title]="status === 'pending' ? 'No hay solicitudes de acceso pendientes' : 'No hay solicitudes con ese filtro'"
          text="Cuando un docente o administrativo intente ingresar con su correo institucional, aparecerá aquí." /></div>
      }
    } @else if (!error()) { <app-skeleton-rows [rows]="5" [cols]="4" /> }
  `,
  styles: `
    .row-actions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
  `,
})
export class AccessPage {
  private readonly api = inject(SaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly data = signal<(Page<AccessRequest> & { pending: number }) | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly fmtAgo = fmtAgo;
  readonly fmtDateTime = fmtDateTime;
  q = '';
  status = 'pending';

  constructor() { void this.load(1); }

  label(r: AccessRequest): string {
    return r.status === 'granted' && r.grantedRole === 'SUPERADMIN' ? 'Acceso dado (Super administrador)' : STATUS_LABEL[r.status];
  }

  search() { void this.load(1); }

  async load(page: number) {
    this.error.set(null);
    try { this.data.set(await this.api.accessRequests({ status: this.status, q: this.q, page })); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar las solicitudes de acceso.')); }
  }

  async grant(r: AccessRequest) {
    const reason = await this.confirm.ask({
      title: `Dar acceso a ${r.name || r.email}`, confirmLabel: 'Dar acceso de administrador', tone: 'primary', reasonMin: 10,
      reasonLabel: 'Motivo (cargo o quién lo autorizó)',
      risk: 'Podrá ingresar con su cuenta de Google y ver todas las solicitudes de los estudiantes, con sus datos. Puedes desactivarlo después desde Usuarios.',
    });
    if (reason === null) return;
    await this.act(() => this.api.grantAccess(r.id, 'ADMIN', reason), `${r.email} ya puede ingresar como administrador`);
  }

  async dismiss(r: AccessRequest) {
    const ok = await this.confirm.ask({ title: 'Descartar solicitud de acceso', confirmLabel: 'Descartar', tone: 'primary',
      risk: 'La persona sigue sin acceso. Si más adelante lo necesita, puedes crearle la cuenta desde Usuarios.' });
    if (ok === null) return;
    await this.act(() => this.api.dismissAccess(r.id, null), 'Solicitud descartada');
  }

  private async act(fn: () => Promise<unknown>, msg: string) {
    this.busy.set(true);
    try { await fn(); this.toast.ok(msg); await this.load(this.data()?.page ?? 1); }
    catch (e) { this.toast.error(apiMessage(e, 'No se pudo completar la acción.')); }
    finally { this.busy.set(false); }
  }
}
