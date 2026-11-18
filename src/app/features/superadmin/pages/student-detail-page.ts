import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { COURSE_LABELS_LONG } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { validateEcuadorianDni } from '../../../core/utils/validators';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { STATUS_LABELS, fmtDate, fmtDateTime } from '../../../shared/ui/format';
import { EmptyState, SkeletonRows, StatusKey } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { SaApi } from '../sa-api.service';

const RELS = ['Madre', 'Padre', 'Abuelo/a', 'Tío/a', 'Hermano/a', 'Tutor legal', 'Otro'];

@Component({
  selector: 'app-sa-student-detail',
  imports: [FormsModule, RouterLink, StatusKey, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/superadmin/estudiantes" class="back"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Estudiantes</a>
    @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
    @if (d(); as x) {
      <div class="page-head">
        <div><h1>{{ x.profile?.names || x.user.email }}</h1>
          <p class="lede">{{ x.user.email }} · cuenta creada el {{ fmtDate(x.user.createdAt) }}
            @if (!x.user.isActive) { · <span class="tag bad">Desactivada</span> }</p></div>
        <div class="actions">
          <a class="btn btn-outline btn-sm" routerLink="/superadmin/solicitudes" [queryParams]="{ search: x.profile?.cedula }">Ver sus solicitudes</a>
          <a class="btn btn-outline btn-sm" routerLink="/superadmin/plazos" [queryParams]="{ excepcion: id() }">Dar excepción de límite</a>
        </div>
      </div>
      <div class="split">
        <div class="col">
          <section class="section">
            <header><h2>Datos personales</h2>
              <span class="end">@if (x.profile?.padronMatch) { <span class="tag ok">En el padrón</span> } @else if (x.profile) { <span class="tag warn">No está en el padrón</span> }</span></header>
            <div class="body">
              @if (x.profile; as p) {
                <dl class="kv">
                  <dt>Nombres</dt><dd>{{ p.names }}</dd><dt>Cédula</dt><dd>{{ p.cedula }}</dd>
                  <dt>Curso</dt><dd>{{ course(p.course) }} {{ p.paralelo }}@if (p.specialty) { · {{ p.specialty }} }</dd>
                  
                  
                  <dt>Estado</dt><dd>{{ p.completed ? 'Datos completos' : 'Le falta el representante principal' }}</dd>
                </dl>
              } @else { <p class="muted">Aún no llena sus datos personales.</p> }
            </div>
          </section>

          <section class="section">
            <header><h2>Solicitudes</h2>
              <span class="end">@for (k of statusKeys(x.requestsByStatus); track k) { <span class="tag">{{ labels[k] }}: {{ x.requestsByStatus[k] }}</span> }</span></header>
            @if (x.requests.length) {
              <table class="dtable">
                <thead><tr><th>Número</th><th>Estado</th><th>Fecha</th><th>Plazo</th></tr></thead>
                <tbody>
                  @for (r of x.requests; track r._id) {
                    <tr><td><a class="cell-link mono" [routerLink]="['/superadmin/solicitudes', r._id]">{{ r.requestNumber }}</a></td>
                      <td><app-status-key [status]="r.status" [label]="labels[r.status]" /></td>
                      <td class="mono">{{ fmtDateTime(r.createdAt) }}</td><td class="mono muted">{{ r.dueAt ? fmtDateTime(r.dueAt) : '—' }}</td></tr>
                  }
                </tbody>
              </table>
            } @else { <app-empty icon="description" title="Sin solicitudes" /> }
          </section>
        </div>

        <div class="col">
        <section class="section" aria-labelledby="h-lock">
          <header><span class="material-symbols-outlined hicon" aria-hidden="true">{{ anyUnlocked(x) ? 'lock_open' : 'lock' }}</span><h2 id="h-lock">Edición de datos</h2></header>
          <div class="body stack">
            @if (!x.profile) {
              <p class="muted">El estudiante todavía no registra sus datos.</p>
            } @else {
              <dl class="kv">
                <dt>Datos del estudiante</dt><dd>@if (x.locks.student) { <span class="key k-cancelado"><span class="sq" aria-hidden="true"></span>Bloqueados</span> } @else { <span class="key k-pendiente"><span class="sq" aria-hidden="true"></span>Edición habilitada</span> }</dd>
                <dt>Representante</dt><dd>@if (x.locks.representative) { <span class="key k-cancelado"><span class="sq" aria-hidden="true"></span>Bloqueado</span> } @else { <span class="key k-pendiente"><span class="sq" aria-hidden="true"></span>Edición habilitada</span> }</dd>
                @if (x.locks.unlockedAt) { <dt>Última habilitación</dt><dd>{{ fmtDateTime(x.locks.unlockedAt) }} · {{ x.locks.unlockReason }}</dd> }
              </dl>
              <p class="muted small">El estudiante registra sus datos una sola vez. Para corregirlos debe solicitarlo en persona; al guardar, se bloquean de nuevo.</p>
              <div class="row">
                <select class="select" [(ngModel)]="unlockScope" aria-label="Qué habilitar">
                  <option value="all">Estudiante y representante</option><option value="student">Solo datos del estudiante</option>
                  <option value="representative">Solo representante</option>
                </select>
                <button type="button" class="btn btn-outline btn-sm" (click)="unlock()" [disabled]="busy()">Habilitar edición…</button>
              </div>
              @if (anyUnlocked(x)) { <button type="button" class="btn btn-text btn-sm lockbtn" (click)="relock()" [disabled]="busy()">Volver a bloquear ahora</button> }
            }
          </div>
        </section>
        <section class="section">
          <header><h2>Representantes</h2></header>
          <div class="body reps">
            @for (r of x.representatives; track r.linkId) {
              <article class="rep" [class.primary]="r.isPrimary">
                <div class="rep-top">
                  <a class="strong" [routerLink]="['/superadmin/representantes', r.id]">{{ r.names }}</a>
                  @if (r.isPrimary) { <span class="tag gold">Principal</span> }
                </div>
                <p class="muted">{{ r.relationship }} · {{ r.cedula }} · {{ r.phone }}</p>
                <div class="rep-act">
                  @if (!r.isPrimary) { <button type="button" class="btn btn-text btn-sm" (click)="primary(r.linkId)" [disabled]="busy()">Hacer principal</button> }
                  <button type="button" class="btn btn-text btn-sm danger" (click)="unlink(r)" [disabled]="busy()">Desvincular</button>
                </div>
              </article>
            } @empty { <p class="alert alert-warning"><span class="material-symbols-outlined" aria-hidden="true">warning</span>Este estudiante no tiene representante vinculado.</p> }

            <details class="add">
              <summary>Vincular representante</summary>
              <form class="form-grid one" (submit)="$event.preventDefault(); addLink()">
                <label class="field"><span class="field-label">Nombres y apellidos</span><input class="input" name="n" [(ngModel)]="nl.names" /></label>
                <label class="field"><span class="field-label">Cédula</span><input class="input" name="c" [(ngModel)]="nl.cedula" maxlength="10" inputmode="numeric" /></label>
                <label class="field"><span class="field-label">Teléfono</span><input class="input" name="t" [(ngModel)]="nl.phone" maxlength="10" inputmode="tel" placeholder="09xxxxxxxx" /></label>
                <label class="field"><span class="field-label">Parentesco</span>
                  <select class="select" name="r" [(ngModel)]="nl.relationship">@for (r of rels; track r) { <option>{{ r }}</option> }</select></label>
                <label class="check"><input type="checkbox" name="p" [(ngModel)]="nl.isPrimary" /> Representante principal</label>
                <p class="field-hint">Si la cédula ya existe, se vincula el representante registrado.</p>
                <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">Vincular</button></div>
              </form>
            </details>
          </div>
        </section>
        </div>
      </div>
    } @else if (!error()) { <app-skeleton-rows [rows]="8" [cols]="3" /> }
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font: var(--label-lg); width: fit-content; }
    .col { display: grid; gap: 16px; }
    .reps { display: grid; gap: 10px; }
    .rep { border: 1px solid var(--outline-variant); border-radius: 10px; padding: 12px 14px; display: grid; gap: 4px; }
    .rep.primary { border-color: #e2b62c; background: #fffbea; }
    .rep-top { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .rep-top a { text-decoration: none; color: var(--on-surface); }
    .rep-act { display: flex; gap: 4px; margin-left: -10px; }
    .danger { --btn-fg: var(--error); }
    .add summary { cursor: pointer; font: var(--label-lg); color: var(--primary-container); padding: 6px 0; }
    .add form { margin-top: 10px; }
    .one { grid-template-columns: 1fr; }
    .stack { display: grid; gap: 10px; } .row { display: flex; gap: 8px; } .row .select { flex: 1; }
    .small { font: var(--label-md); font-weight: 400; } .hicon { color: var(--on-surface-variant); font-size: 20px; } .lockbtn { justify-self: start; }
    .section > table { border-top: 0; }
  `,
})
export class StudentDetailPage {
  private readonly api = inject(SaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly id = input.required<string>();
  readonly d = signal<any>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly labels = STATUS_LABELS;
  readonly rels = RELS;
  readonly fmtDate = fmtDate;
  readonly fmtDateTime = fmtDateTime;
  nl = { names: '', cedula: '', phone: '', relationship: 'Madre', isPrimary: false };
  unlockScope = 'all';
  anyUnlocked(x: any) { return !!x.profile && (!x.locks.student || !x.locks.representative); }

  constructor() { queueMicrotask(() => void this.load()); }
  course(c: string) { return COURSE_LABELS_LONG[c] ?? c; }
  statusKeys(o: Record<string, number>) { return Object.keys(o ?? {}); }

  async load() {
    try { this.d.set(await this.api.student(this.id())); } catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar la ficha.')); }
  }

  private async run(fn: () => Promise<{ representatives: unknown[] }>, ok: string) {
    this.busy.set(true);
    try { await fn(); this.toast.ok(ok); await this.load(); } catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }

  async unlock() {
    const what = { all: 'sus datos y los del representante', student: 'sus datos', representative: 'los datos del representante' }[this.unlockScope] ?? 'sus datos';
    const reason = await this.confirm.ask({ title: 'Habilitar edición de datos', confirmLabel: 'Habilitar', tone: 'primary', reasonMin: 10,
      reasonLabel: 'Motivo (solicitud presencial)',
      risk: `El estudiante podrá corregir ${what} desde su cuenta. Al guardar, se bloquean otra vez. Queda registrado a tu nombre.` });
    if (reason === null) return;
    this.busy.set(true);
    try { this.d.set(await this.api.unlockStudent(this.id(), reason, this.unlockScope)); this.toast.ok('Edición habilitada'); }
    catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }

  async relock() {
    this.busy.set(true);
    try { this.d.set(await this.api.lockStudent(this.id())); this.toast.ok('Datos bloqueados'); }
    catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }

  primary(linkId: string) { return this.run(() => this.api.setPrimary(linkId), 'Representante principal actualizado'); }

  async unlink(r: { linkId: string; names: string; isPrimary: boolean }) {
    const reason = await this.confirm.ask({ title: `Desvincular a ${r.names}`, confirmLabel: 'Desvincular', reasonMin: 10,
      risk: r.isPrimary ? 'Es el representante principal: si hay otro vinculado, pasará a ser el principal. Si no, el estudiante no podrá enviar solicitudes hasta registrar uno.'
        : 'El vínculo se marca como inactivo (no se borra) y deja de aparecer en las solicitudes nuevas.' });
    if (reason === null) return;
    await this.run(() => this.api.unlink(r.linkId, reason), 'Representante desvinculado');
  }

  async addLink() {
    if (!validateEcuadorianDni(this.nl.cedula)) { this.toast.error('La cédula del representante no es válida.'); return; }
    await this.run(() => this.api.link({ studentUserId: this.id(), ...this.nl, names: this.nl.names.trim() }), 'Representante vinculado');
    this.nl = { names: '', cedula: '', phone: '', relationship: 'Madre', isPrimary: false };
  }
}
