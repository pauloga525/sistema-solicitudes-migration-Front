import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../../core/utils/errors';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { fmtDateTime } from '../../../shared/ui/format';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { Dict, Period, SaApi } from '../sa-api.service';

const RT = 'proceso_mejora';

@Component({
  selector: 'app-sa-limits',
  imports: [FormsModule, RouterLink, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Plazos y límites</h1>
      <p class="lede">Todo se valida en el servidor al crear la solicitud, también con envíos simultáneos. Las horas son de Ecuador (America/Guayaquil).</p></div></div>

    <div class="tabs" role="tablist">
      @for (t of tabs; track t.k) {
        <button type="button" role="tab" [attr.aria-selected]="tab() === t.k" (click)="tab.set(t.k)">{{ t.label }}</button>
      }
    </div>

    @switch (tab()) {
      @case ('plazos') {
        <div class="split">
          <section class="section"><header><h2>Ventanas de envío</h2></header>
            @if (deadlines(); as list) {
              @if (list.length) {
                <table class="dtable">
                  <thead><tr><th>Periodo</th><th>Abre</th><th>Cierra</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    @for (d of list; track d['id']) {
                      <tr>
                        <td>{{ d['periodLabel'] }}</td><td class="mono">{{ dt(d['opensAt']) }}</td><td class="mono">{{ dt(d['closesAt']) }}</td>
                        <td><span class="tag" [class.ok]="d['state'] === 'abierto'" [class.bad]="d['state'] === 'cerrado'" [class.info]="d['state'] === 'por abrir'">{{ d['state'] }}</span></td>
                        <td class="row-actions"><button type="button" class="btn btn-text btn-sm" (click)="toggle(d)">{{ d['isActive'] ? 'Desactivar' : 'Activar' }}</button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else { <app-empty icon="event_available" title="Sin ventanas definidas" text="Mientras no definas una, rige solo el aporte activo del calendario (comportamiento original)." /> }
            } @else { <app-skeleton-rows [cols]="4" /> }
          </section>
          <div class="col">
            <section class="section"><header><h2>Definir ventana</h2></header>
              <form class="body form-grid one" (submit)="$event.preventDefault(); saveDeadline()">
                <label class="field"><span class="field-label">Periodo</span>
                  <select class="select" name="pk" [(ngModel)]="dl.periodKey"><option value="">Todos los periodos</option>
                    @for (p of periods(); track p.key) { <option [value]="p.key">{{ p.anio }} · {{ p.trimestre }} · {{ p.aporte }}{{ p.isCurrent ? ' (vigente)' : '' }}</option> }</select></label>
                <label class="field"><span class="field-label">Abre</span><input class="input" type="datetime-local" name="o" [(ngModel)]="dl.opensAt" required /></label>
                <label class="field"><span class="field-label">Cierra</span><input class="input" type="datetime-local" name="c" [(ngModel)]="dl.closesAt" required /></label>
                <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !dl.opensAt || !dl.closesAt">Guardar ventana</button></div>
              </form>
            </section>
            <section class="section"><header><h2>Varios periodos a la vez</h2></header>
              <form class="body form-grid one" (submit)="$event.preventDefault(); bulk()">
                <p class="muted">Usa las fechas de cada aporte del calendario, de la hora de apertura a la de cierre.</p>
                <div class="checks">
                  @for (p of periods(); track p.key) {
                    <label class="check"><input type="checkbox" [checked]="bulkKeys().includes(p.key)" (change)="toggleKey(p.key)" />{{ p.trimestre }} · {{ p.aporte }}</label>
                  } @empty { <p class="muted">No hay aportes en el calendario. Créalos en <a routerLink="/admin/plazos">Plazos académicos</a>.</p> }
                </div>
                <div class="row"><label class="field"><span class="field-label">Hora de apertura</span><input class="input" type="time" name="oh" [(ngModel)]="openHour" /></label>
                  <label class="field"><span class="field-label">Hora de cierre</span><input class="input" type="time" name="ch" [(ngModel)]="closeHour" /></label></div>
                <div class="form-actions"><button type="submit" class="btn btn-outline btn-sm" [disabled]="busy() || !bulkKeys().length">Aplicar a {{ bulkKeys().length }} periodos</button></div>
              </form>
            </section>
          </div>
        </div>
      }
      @case ('limites') {
        <div class="split">
          <section class="section"><header><h2>Límites vigentes</h2></header>
            <div class="body">
              @if (limits(); as l) {
                <p class="muted">{{ l['subjectQuota']?.note }}</p>
                <table class="dtable">
                  <thead><tr><th>Ventana</th><th class="num">Máximo de solicitudes</th><th>Estado</th></tr></thead>
                  <tbody>
                    @for (x of l['limits']; track x.id) {
                      <tr><td>{{ x.scopeLabel }}</td><td class="num">{{ x.maxRequests }}</td><td>@if (x.isActive) { <span class="tag ok">Activo</span> } @else { <span class="tag">Inactivo</span> }</td></tr>
                    } @empty { <tr><td colspan="3" class="muted">Sin límite por número de solicitudes; solo rige el cupo de materias.</td></tr> }
                  </tbody>
                </table>
              } @else { <app-skeleton-rows [rows]="3" [cols]="3" /> }
            </div>
          </section>
          <section class="section"><header><h2>Configurar límite</h2></header>
            <form class="body form-grid one" (submit)="$event.preventDefault(); saveLimit()">
              <label class="field"><span class="field-label">Ventana</span>
                <select class="select" name="scope" [(ngModel)]="lim.scope" (ngModelChange)="preview.set(null)">
                  <option value="aporte">Por aporte (periodo)</option><option value="week">Por semana</option><option value="day">Por día</option></select></label>
              <label class="field"><span class="field-label">Máximo por estudiante</span>
                <input class="input" type="number" min="1" max="100" name="max" [(ngModel)]="lim.maxRequests" (ngModelChange)="preview.set(null)" /></label>
              <label class="check"><input type="checkbox" name="act" [(ngModel)]="lim.isActive" /> Límite activo</label>
              <button type="button" class="btn btn-outline btn-sm" (click)="doPreview()" [disabled]="busy()">Ver a quién afecta</button>
              @if (preview(); as p) {
                <div class="alert" [class.alert-warning]="p['over'] > 0" [class.alert-info]="!p['over']" role="status">
                  <span class="material-symbols-outlined" aria-hidden="true">group</span>
                  <span>@if (p['note']) { {{ p['note'] }} } @else {
                    En la ventana actual, {{ p['students'] }} estudiantes ya enviaron solicitudes: <strong>{{ p['over'] }}</strong> quedarían por encima del límite,
                    <strong>{{ p['atLimit'] }}</strong> justo en el límite y {{ p['below'] }} por debajo. Los que superan no pierden lo enviado; solo no podrán enviar más. }</span>
                </div>
              }
              <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !preview()">Guardar límite</button></div>
            </form>
          </section>
        </div>
      }
      @case ('excepciones') {
        <div class="split">
          <section class="section"><header><h2>Excepciones</h2></header>
            @if (exceptions(); as ex) {
              @if (ex.length) {
                <table class="dtable">
                  <thead><tr><th>Estudiante</th><th class="num">Extra</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    @for (e of ex; track e['id']) {
                      <tr>
                        <td><a class="cell-link" [routerLink]="['/superadmin/estudiantes', e['studentUserId']]">{{ e['studentName'] || 'Estudiante' }}</a><span class="sub">{{ dt(e['createdAt']) }}</span></td>
                        <td class="num">+{{ e['extra'] }}</td><td class="reason">{{ e['reason'] }}</td>
                        <td>@if (e['isActive']) { <span class="tag ok">Vigente</span> } @else { <span class="tag" [title]="$any(e['revokeReason'])">Revocada</span> }</td>
                        <td class="row-actions">@if (e['isActive']) { <button type="button" class="btn btn-text btn-sm" (click)="revoke(e)">Revocar</button> }</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else { <app-empty icon="approval" title="Sin excepciones" text="Una excepción permite a un estudiante enviar más solicitudes de las que permite el límite en un periodo." /> }
            } @else { <app-skeleton-rows [cols]="4" /> }
          </section>
          <section class="section"><header><h2>Nueva excepción</h2></header>
            <form class="body form-grid one" (submit)="$event.preventDefault(); grant()">
              <label class="field"><span class="field-label">Buscar estudiante</span>
                <div class="row"><input class="input" name="sq" [(ngModel)]="sq" placeholder="Nombre o cédula" />
                  <button type="button" class="btn btn-outline btn-sm" (click)="findStudents()">Buscar</button></div></label>
              @if (found().length) {
                <label class="field"><span class="field-label">Estudiante</span>
                  <select class="select" name="sid" [(ngModel)]="ex.studentUserId">
                    @for (s of found(); track s['id']) { <option [value]="s['id']">{{ s['name'] || s['email'] }}</option> }</select></label>
              }
              <label class="field"><span class="field-label">Periodo</span>
                <select class="select" name="ep" [(ngModel)]="ex.periodKey"><option value="">El vigente</option>
                  @for (p of periods(); track p.key) { <option [value]="p.key">{{ p.trimestre }} · {{ p.aporte }}</option> }</select></label>
              <label class="field"><span class="field-label">Solicitudes adicionales</span><input class="input" type="number" min="1" max="20" name="extra" [(ngModel)]="ex.extra" /></label>
              <label class="field"><span class="field-label">Motivo (queda en la auditoría)</span><textarea class="textarea" name="reason" rows="2" [(ngModel)]="ex.reason" maxlength="500"></textarea></label>
              <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !ex.studentUserId || ex.reason.trim().length < 10">Otorgar excepción</button></div>
            </form>
          </section>
        </div>
      }
    }
  `,
  styles: `
    .col { display: grid; gap: 16px; align-content: start; }
    .one { grid-template-columns: 1fr; }
    .row { display: flex; gap: 8px; align-items: flex-end; } .row > * { flex: 1; }
    .checks { display: grid; gap: 6px; max-height: 220px; overflow: auto; }
    .reason { max-width: 280px; color: var(--on-surface-variant); }
    .section > table { border-top: 0; }
  `,
})
export class LimitsPage {
  private readonly api = inject(SaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly excepcion = input<string>();
  readonly tabs = [{ k: 'plazos', label: 'Ventanas de envío' }, { k: 'limites', label: 'Límites' }, { k: 'excepciones', label: 'Excepciones' }];
  readonly tab = signal('plazos');
  readonly periods = signal<Period[]>([]);
  readonly deadlines = signal<Dict[] | null>(null);
  readonly limits = signal<any>(null);
  readonly exceptions = signal<Dict[] | null>(null);
  readonly preview = signal<any>(null);
  readonly found = signal<Dict[]>([]);
  readonly bulkKeys = signal<string[]>([]);
  readonly busy = signal(false);
  readonly dt = (v: unknown) => fmtDateTime(v as string);
  dl = { periodKey: '', opensAt: '', closesAt: '' };
  openHour = '00:00'; closeHour = '23:59';
  lim = { scope: 'aporte', maxRequests: 2, isActive: true };
  ex = { studentUserId: '', periodKey: '', extra: 1, reason: '' };
  sq = '';

  constructor() {
    this.api.periods().then((p) => this.periods.set(p), () => undefined);
    void this.reload();
    queueMicrotask(() => {
      const sid = this.excepcion();
      if (sid) {
        this.tab.set('excepciones');
        this.ex.studentUserId = sid;
        this.api.student(sid).then((s: any) => this.found.set([{ id: sid, name: s.profile?.names, email: s.user?.email }]), () => undefined);
      }
    });
  }

  async reload() {
    const [d, l, e] = await Promise.allSettled([this.api.deadlines(), this.api.limits(), this.api.exceptions()]);
    if (d.status === 'fulfilled') this.deadlines.set(d.value);
    if (l.status === 'fulfilled') this.limits.set(l.value);
    if (e.status === 'fulfilled') this.exceptions.set(e.value);
  }

  private async run(fn: () => Promise<unknown>, ok: string) {
    this.busy.set(true);
    try { await fn(); this.toast.ok(ok); await this.reload(); return true; }
    catch (e) { this.toast.error(apiMessage(e)); return false; }
    finally { this.busy.set(false); }
  }

  saveDeadline() {
    return this.run(() => this.api.putDeadline({ requestType: RT, periodKey: this.dl.periodKey || null, opensAt: this.dl.opensAt, closesAt: this.dl.closesAt }), 'Ventana guardada');
  }
  toggleKey(k: string) { this.bulkKeys.update((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k])); }
  async bulk() {
    const ok = await this.run(() => this.api.bulkDeadlines({ requestType: RT, periodKeys: this.bulkKeys(), openHour: this.openHour, closeHour: this.closeHour }), 'Ventanas aplicadas');
    if (ok) this.bulkKeys.set([]);
  }
  async toggle(d: Dict) {
    if (d['isActive']) {
      const r = await this.confirm.ask({ title: 'Desactivar ventana', confirmLabel: 'Desactivar', tone: 'primary',
        risk: 'Sin esta ventana, el envío solo queda limitado por el aporte activo del calendario.' });
      if (r === null) return;
    }
    await this.run(() => this.api.toggleDeadline(String(d['id'])), 'Ventana actualizada');
  }

  async doPreview() {
    try { this.preview.set(await this.api.previewLimit({ requestType: RT, scope: this.lim.scope, maxRequests: Number(this.lim.maxRequests) })); }
    catch (e) { this.toast.error(apiMessage(e)); }
  }
  async saveLimit() {
    const over = Number(this.preview()?.['over'] ?? 0);
    const r = await this.confirm.ask({ title: 'Guardar límite', confirmLabel: 'Guardar', tone: over ? 'danger' : 'primary',
      risk: over ? `${over} estudiantes ya superan este límite y no podrán enviar más solicitudes en esta ventana.` : 'El nuevo límite rige desde el siguiente envío.' });
    if (r === null) return;
    await this.run(() => this.api.putLimit({ requestType: RT, scope: this.lim.scope, maxRequests: Number(this.lim.maxRequests), isActive: this.lim.isActive }), 'Límite guardado');
    this.preview.set(null);
  }

  async findStudents() {
    try {
      const p = await this.api.students({ q: this.sq.trim(), pageSize: 20 });
      this.found.set(p.rows);
      this.ex.studentUserId = p.rows[0] ? String(p.rows[0]['id']) : '';
      if (!p.rows.length) this.toast.show('No encontramos estudiantes con ese dato', 'info');
    } catch (e) { this.toast.error(apiMessage(e)); }
  }
  async grant() {
    const ok = await this.run(() => this.api.grantException({ studentUserId: this.ex.studentUserId, requestType: RT, periodKey: this.ex.periodKey || null,
      extra: Number(this.ex.extra), reason: this.ex.reason.trim() }), 'Excepción otorgada');
    if (ok) this.ex = { studentUserId: '', periodKey: '', extra: 1, reason: '' };
  }
  async revoke(e: Dict) {
    const reason = await this.confirm.ask({ title: 'Revocar excepción', confirmLabel: 'Revocar', reasonMin: 10,
      risk: 'El estudiante vuelve al límite general desde su próximo envío. Lo que ya envió no cambia.' });
    if (reason === null) return;
    await this.run(() => this.api.revokeException(String(e['id']), reason), 'Excepción revocada');
  }
}
