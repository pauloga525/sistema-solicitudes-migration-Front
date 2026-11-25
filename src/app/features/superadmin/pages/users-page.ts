import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../core/auth/session.service';
import { apiMessage } from '../../../core/utils/errors';
import { validateEcuadorianDni } from '../../../core/utils/validators';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { ROLE_LABELS, fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { Dict, Page, SaApi, UserRow } from '../sa-api.service';

@Component({
  selector: 'app-sa-users',
  imports: [FormsModule, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Administradores</h1><p class="lede">Cuentas de administración (vicerrectorado, secretaría) y de super administración. Los estudiantes, docentes y representantes tienen su propia sección. Desactivar solo impide el ingreso; eliminar borra la cuenta definitivamente.</p></div>
      <div class="actions"><button type="button" class="btn btn-primary" (click)="openCreate()"><span class="material-symbols-outlined" aria-hidden="true">person_add</span>Nuevo administrador</button></div>
    </div>

    <form class="filters" (submit)="$event.preventDefault(); search()" role="search">
      <label class="field grow"><span class="field-label">Buscar</span>
        <input class="input" type="search" name="q" [(ngModel)]="q" placeholder="Nombre, correo o usuario" /></label>
      <label class="field"><span class="field-label">Rol</span>
        <select class="select" name="role" [(ngModel)]="role" (ngModelChange)="search()">
          <option value="">Todos</option><option value="ADMIN">Administrador</option><option value="SUPERADMIN">Super administrador</option>
        </select></label>
      <label class="field"><span class="field-label">Estado</span>
        <select class="select" name="status" [(ngModel)]="status" (ngModelChange)="search()">
          <option value="">Todos</option><option value="active">Activos</option><option value="inactive">Desactivados</option><option value="pending">Con contraseña temporal</option>
        </select></label>
      <button type="submit" class="btn btn-outline">Buscar</button>
    </form>

    <div class="table-wrap">
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (loading() && !page()) { <app-skeleton-rows [cols]="5" /> }
      @else if (page()?.rows?.length) {
        <div class="table-scroll">
          <table class="dtable">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th class="num">Creado</th></tr></thead>
            <tbody>
              @for (u of page()!.rows; track u.id) {
                <tr class="clickable" (click)="open(u)">
                  <td><button type="button" class="linkish strong" (click)="$event.stopPropagation(); open(u)">{{ u.name || '(sin nombre)' }}</button><span class="sub">{{ u.email || u.username }}</span></td>
                  <td>{{ roleLabels[u.role] }}
                    @if (u.legacy) { <span class="tag" title="Cuenta copiada del sistema anterior">original</span> }</td>
                  <td>
                    @if (!u.isActive) { <span class="key k-rechazado"><span class="sq" aria-hidden="true"></span>Desactivado</span> }
                    @else if (u.forcePasswordChange) { <span class="key k-pendiente"><span class="sq" aria-hidden="true"></span>Contraseña temporal</span> }
                    @else { <span class="key k-aprobado"><span class="sq" aria-hidden="true"></span>Activo</span> }
                  </td>
                  <td class="muted">{{ u.lastLoginAt ? fmtAgo(u.lastLoginAt) : 'Nunca' }}</td>
                  <td class="num muted">{{ fmtDate(u.createdAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [page]="page()!.page" [pageSize]="page()!.pageSize" [total]="page()!.total" [totalPages]="page()!.totalPages" (go)="go($event)" />
      } @else if (!loading()) {
        <app-empty icon="person_search" title="No hay administradores con esos filtros" text="Cambia el rol, el estado o el texto de búsqueda." />
      }
    </div>

    <!-- Alta -->
    <dialog #createDlg class="sheet" aria-labelledby="cu-title" (close)="createOpen.set(false)">
      <div class="sheet-head"><h2 id="cu-title">Nueva cuenta</h2>
        <button type="button" class="icon-btn" (click)="createDlg.close()" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button></div>
      <div class="sheet-body">
        @if (created(); as c) {
          <p class="alert alert-success"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span>Cuenta creada para {{ c.user.email }}.</p>
          @if (c.tempPassword) {
            <p>Contraseña temporal. <strong>Solo se muestra esta vez</strong>; vence el {{ fmtDateTime(c.expiresAt) }} y se pedirá cambiarla al ingresar.</p>
            <div class="temp-pass"><span>{{ c.tempPassword }}</span>
              <button type="button" class="btn btn-gold btn-sm" (click)="copy(c.tempPassword)">Copiar</button></div>
          } @else {
            <p>Ingresa con su cuenta institucional de Google ({{ c.user.email }}). No necesita contraseña.</p>
          }
          <div class="form-actions"><button type="button" class="btn btn-primary" (click)="createDlg.close()">Listo</button></div>
        } @else {
          <form class="form-grid one" (submit)="$event.preventDefault(); create()">
            <label class="field"><span class="field-label">Nombres y apellidos</span>
              <input class="input" name="name" [(ngModel)]="nu.name" required minlength="5" maxlength="120" autocomplete="off" /></label>
            <label class="field"><span class="field-label">Correo institucional</span>
              <input class="input" name="email" type="email" [(ngModel)]="nu.email" required [placeholder]="'nombre@' + session.emailDomain()" autocomplete="off" />
              <span class="field-hint">Debe terminar en &#64;{{ session.emailDomain() }}</span></label>
            <label class="field"><span class="field-label">Cédula</span>
              <input class="input" name="cedula" [(ngModel)]="nu.cedula" inputmode="numeric" maxlength="10" required
                     [class.invalid]="nu.cedula.length === 10 && !cedOk(nu.cedula)" />
              @if (nu.cedula.length === 10 && !cedOk(nu.cedula)) { <span class="field-error">La cédula no es válida.</span> }</label>
            <label class="field"><span class="field-label">Rol</span>
              <select class="select" name="role" [(ngModel)]="nu.role">
                <option value="ADMIN">Administrador</option><option value="SUPERADMIN">Super administrador</option><option value="TEACHER">Docente (aparecerá en Docentes)</option><option value="STUDENT">Estudiante (aparecerá en Estudiantes)</option>
              </select>
              @if (nu.role === 'SUPERADMIN') { <span class="field-hint">Tendrá control total del sistema. Quedará registrado como escalamiento de privilegios.</span> }</label>
            @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
            <div class="form-actions">
              <button type="button" class="btn btn-text" (click)="createDlg.close()">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Creando…' : (session.passwordLogin() ? 'Crear y generar contraseña' : 'Crear cuenta') }}</button>
            </div>
          </form>
        }
      </div>
    </dialog>

    <!-- Detalle -->
    <dialog #detailDlg class="sheet" aria-labelledby="du-title" (close)="sel.set(null)">
      @if (sel(); as u) {
        <div class="sheet-head"><h2 id="du-title">{{ u.name || u.email || u.username }}</h2>
          <button type="button" class="icon-btn" (click)="detailDlg.close()" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button></div>
        <div class="sheet-body">
          @if (temp(); as t) {
            <p>Nueva contraseña temporal. <strong>Solo se muestra esta vez</strong>; vence el {{ fmtDateTime(t.expiresAt) }}. Las sesiones abiertas del usuario se cerraron.</p>
            <div class="temp-pass"><span>{{ t.tempPassword }}</span><button type="button" class="btn btn-gold btn-sm" (click)="copy(t.tempPassword)">Copiar</button></div>
          }
          <dl class="kv">
            <dt>Correo</dt><dd>{{ u.email || '—' }}</dd>
            <dt>Usuario</dt><dd>{{ u.username || '—' }}</dd>
            <dt>Cédula</dt><dd>{{ u.cedula || '—' }}</dd>
            <dt>Rol</dt><dd>{{ roleLabels[u.role] }}</dd>
            <dt>Ingreso</dt><dd>{{ u.google ? 'Cuenta de Google vinculada' : 'Sin Google' }}{{ u.hasPassword ? ' · con contraseña' : ' · sin contraseña' }}</dd>
            <dt>Estado</dt><dd>{{ u.isActive ? 'Activo' : 'Desactivado' }}@if (u.forcePasswordChange) { · contraseña temporal hasta {{ fmtDateTime(u.tempPasswordExpiresAt) }} }</dd>
            <dt>Último ingreso</dt><dd>{{ u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Nunca' }}</dd>
            <dt>Creado</dt><dd>{{ fmtDateTime(u.createdAt) }}</dd>
          </dl>

          @if (isSelf()) {
            <p class="alert alert-info"><span class="material-symbols-outlined" aria-hidden="true">info</span>Es tu propia cuenta: no puedes cambiar tu rol ni desactivarte. Para cambiar tu contraseña usa «Cambiar contraseña».</p>
          } @else {
            <section class="block">
              <h3>Rol</h3>
              <div class="row">
                <select class="select" [(ngModel)]="newRole" aria-label="Nuevo rol">
                  <option value="TEACHER">Docente</option><option value="ADMIN">Administrador</option><option value="SUPERADMIN">Super administrador</option>
                  @if (u.role === 'STUDENT') { <option value="STUDENT">Estudiante</option> }
                </select>
                <button type="button" class="btn btn-outline" [disabled]="newRole === u.role || busy()" (click)="changeRole(u)">Cambiar rol</button>
              </div>
            </section>
            <section class="block">
              <h3>Acceso</h3>
              <div class="row wrap">
                @if (session.passwordLogin()) {
                  <button type="button" class="btn btn-outline" (click)="reset(u)" [disabled]="busy() || !u.isActive">
                    <span class="material-symbols-outlined" aria-hidden="true">key</span>Restablecer contraseña</button>
                }
                @if (u.isActive) {
                  <button type="button" class="btn btn-danger-outline" (click)="deactivate(u)" [disabled]="busy()">
                    <span class="material-symbols-outlined" aria-hidden="true">block</span>Desactivar</button>
                } @else {
                  <button type="button" class="btn btn-success" (click)="reactivate(u)" [disabled]="busy()">Reactivar</button>
                }
              </div>
            </section>
          }

          <section class="block">
            <h3>Editar datos</h3>
            <form class="form-grid one" (submit)="$event.preventDefault(); save(u)">
              <label class="field"><span class="field-label">Nombres</span><input class="input" name="ename" [(ngModel)]="edit.name" maxlength="120" /></label>
              <label class="field"><span class="field-label">Correo</span><input class="input" name="eemail" type="email" [(ngModel)]="edit.email" /></label>
              <label class="field"><span class="field-label">Cédula</span><input class="input" name="eced" [(ngModel)]="edit.cedula" maxlength="10" inputmode="numeric" /></label>
              <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">Guardar cambios</button></div>
            </form>
          </section>

          @if (!isSelf()) {
            <section class="block danger-zone">
              <h3>Eliminar cuenta</h3>
              <p class="muted">Borra la cuenta de forma permanente{{ u.role === 'STUDENT' ? ', con sus datos de estudiante y representantes' : '' }}.
                Las solicitudes y la auditoría se conservan. Si solo quieres impedir el ingreso, usa Desactivar.</p>
              <div class="row"><button type="button" class="btn btn-danger-outline" (click)="remove(u)" [disabled]="busy()">
                <span class="material-symbols-outlined" aria-hidden="true">delete_forever</span>Eliminar cuenta…</button></div>
            </section>
          }

          <section class="block">
            <h3>Historial de accesos</h3>
            @if (access(); as a) {
              @if (a.rows.length) {
                <table class="dtable compact">
                  <thead><tr><th>Fecha</th><th>Evento</th><th>IP</th></tr></thead>
                  <tbody>
                    @for (e of a.rows; track e['id']) {
                      <tr>
                        <td class="mono">{{ fmtDateTime($any(e['createdAt'])) }}</td>
                        <td>{{ e['eventLabel'] }}
                          @if (e['result'] === 'FAILURE') { <span class="tag bad">Fallido</span> }
                          @if ($any(e['metadata'])?.reason) { <span class="sub">{{ reasonLabel($any(e['metadata']).reason) }}</span> }</td>
                        <td class="mono muted">{{ e['actorIp'] || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (a.totalPages > 1) { <app-pager [page]="a.page" [pageSize]="a.pageSize" [total]="a.total" [totalPages]="a.totalPages" (go)="loadAccess(u.id, $event)" /> }
              } @else { <p class="muted">Sin eventos registrados.</p> }
            } @else { <app-skeleton-rows [rows]="3" [cols]="3" /> }
          </section>
        </div>
      }
    </dialog>
  `,
  styles: `
    .linkish { border: 0; background: none; padding: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
    .linkish:hover { color: var(--primary-container); text-decoration: underline; }
    .block { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--outline-variant); }
    .block h3 { font: var(--title-md); }
    .danger-zone h3 { color: var(--error); }
    .danger-zone p { margin: 0; font-size: 0.875rem; }
    .row { display: flex; gap: 8px; } .row .select { flex: 1; } .wrap { flex-wrap: wrap; }
    .one { grid-template-columns: 1fr; }
    .compact td, .compact th { padding: 8px 10px; height: auto; }
  `,
})
export class UsersPage {
  private readonly api = inject(SaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly session = inject(SessionService);
  readonly roleLabels = ROLE_LABELS;
  readonly fmtAgo = fmtAgo;
  readonly fmtDateTime = fmtDateTime;
  readonly fmtDate = (v: string) => (v ? new Date(v).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' }) : '—');
  readonly cedOk = validateEcuadorianDni;

  q = ''; role = ''; status = '';
  readonly pageNo = signal(1);
  readonly page = signal<Page<UserRow> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);

  nu = { name: '', email: '', cedula: '', role: 'ADMIN' };
  readonly createOpen = signal(false);
  readonly created = signal<{ user: UserRow; tempPassword: string | null; expiresAt: string | null } | null>(null);
  private readonly createDlg = viewChild.required<ElementRef<HTMLDialogElement>>('createDlg');
  private readonly detailDlg = viewChild.required<ElementRef<HTMLDialogElement>>('detailDlg');

  readonly sel = signal<UserRow | null>(null);
  readonly access = signal<Page<Dict> | null>(null);
  readonly temp = signal<{ tempPassword: string; expiresAt: string } | null>(null);
  readonly isSelf = computed(() => this.sel()?.id === this.session.user()?.id);
  newRole = 'ADMIN';
  edit = { name: '', email: '', cedula: '' };

  constructor() {
    void this.load();
    effect(() => { if (!this.createOpen()) this.created.set(null); });
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.page.set(await this.api.users({ q: this.q.trim(), role: this.role || 'staff', status: this.status, page: this.pageNo() }));
    } catch (e) {
      this.error.set(apiMessage(e, 'No pudimos cargar los usuarios.'));
    } finally {
      this.loading.set(false);
    }
  }

  search() { this.pageNo.set(1); void this.load(); }
  go(p: number) { this.pageNo.set(p); void this.load(); }

  openCreate() {
    this.nu = { name: '', email: '', cedula: '', role: 'ADMIN' };
    this.formError.set(null);
    this.created.set(null);
    this.createOpen.set(true);
    this.createDlg().nativeElement.showModal();
  }

  async create() {
    if (!validateEcuadorianDni(this.nu.cedula)) { this.formError.set('Revisa la cédula: no es válida.'); return; }
    if (!this.nu.email.trim().toLowerCase().endsWith('@' + this.session.emailDomain())) {
      this.formError.set(`El correo debe ser institucional (@${this.session.emailDomain()}).`); return;
    }
    if (this.nu.role === 'SUPERADMIN') {
      const ok = await this.confirm.ask({ title: 'Crear un super administrador', confirmLabel: 'Crear super administrador',
        risk: 'Esta persona podrá cambiar roles, desactivar cuentas, corregir estados y ver datos personales cifrados. El alta queda auditada.' });
      if (ok === null) return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      this.created.set(await this.api.createUser({ ...this.nu, email: this.nu.email.trim(), name: this.nu.name.trim() }));
      void this.load();
    } catch (e) {
      this.formError.set(apiMessage(e, 'No pudimos crear el usuario.'));
    } finally {
      this.busy.set(false);
    }
  }

  async open(u: UserRow) {
    this.temp.set(null);
    this.access.set(null);
    this.sel.set(u);
    this.newRole = u.role;
    this.detailDlg().nativeElement.showModal();
    try {
      const full = await this.api.user(u.id);
      this.sel.set(full);
      this.edit = { name: full.name ?? '', email: full.email ?? '', cedula: full.cedula ?? '' };
    } catch (e) { this.toast.error(apiMessage(e)); }
    void this.loadAccess(u.id, 1);
  }

  async loadAccess(id: string, p: number) {
    try { this.access.set(await this.api.access(id, p)); } catch { this.access.set({ rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }); }
  }

  private async act(fn: () => Promise<unknown>, ok: string) {
    this.busy.set(true);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'id' in (r as object)) this.sel.set(r as UserRow);
      this.toast.ok(ok);
      void this.load();
      const s = this.sel();
      if (s) void this.loadAccess(s.id, 1);
    } catch (e) {
      this.toast.error(apiMessage(e, 'No se pudo completar la acción.'));
    } finally {
      this.busy.set(false);
    }
  }

  async changeRole(u: UserRow) {
    const up = this.newRole === 'SUPERADMIN';
    const reason = await this.confirm.ask({
      title: `Cambiar rol a ${ROLE_LABELS[this.newRole]}`, confirmLabel: 'Cambiar rol', reasonMin: 10,
      risk: up ? 'Le das control total del sistema. Se registra como escalamiento de privilegios y sus sesiones se cierran.'
        : u.role === 'SUPERADMIN' ? 'Pierde el acceso al panel de super administración. Sus sesiones abiertas se cierran.'
        : this.newRole === 'TEACHER' ? 'Entrará al panel docente y saldrá de esta lista: la verás en Docentes, donde puedes asignarle materias. Sus sesiones abiertas se cierran.'
        : 'Cambia lo que puede ver y hacer. Sus sesiones abiertas se cierran.',
    });
    if (reason === null) return;
    const toTeacher = this.newRole === 'TEACHER';
    await this.act(() => this.api.changeRole(u.id, this.newRole, reason), toTeacher ? 'Ahora es docente: asígnale materias en Docentes' : 'Rol actualizado');
  }

  async deactivate(u: UserRow) {
    const reason = await this.confirm.ask({ title: 'Desactivar cuenta', confirmLabel: 'Desactivar', reasonMin: 10,
      risk: 'No podrá ingresar y sus sesiones abiertas se cierran. La cuenta y su historial se conservan; puedes reactivarla después.' });
    if (reason === null) return;
    await this.act(() => this.api.deactivate(u.id, reason), 'Cuenta desactivada');
  }

  async remove(u: UserRow) {
    const ident = u.email || u.username || '';
    const reason = await this.confirm.ask({
      title: 'Eliminar cuenta', confirmLabel: 'Eliminar definitivamente', reasonMin: 10, typeToConfirm: ident,
      risk: u.role === 'STUDENT'
        ? 'Se borran la cuenta, sus datos de estudiante y los representantes que no estén vinculados a otro estudiante. No se puede deshacer. Sus solicitudes se conservan.'
        : 'Se borra la cuenta y no se puede deshacer. Las solicitudes que tenía asignadas quedan sin responsable; la auditoría se conserva.',
    });
    if (reason === null) return;
    this.busy.set(true);
    try {
      await this.api.deleteUser(u.id, reason, ident);
      this.toast.ok('Cuenta eliminada');
      this.detailDlg().nativeElement.close();
      void this.load();
    } catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }

  async reactivate(u: UserRow) { await this.act(() => this.api.reactivate(u.id), 'Cuenta reactivada'); }

  async reset(u: UserRow) {
    const ok = await this.confirm.ask({ title: 'Restablecer contraseña', confirmLabel: 'Generar contraseña temporal',
      risk: 'La contraseña actual deja de funcionar y se cierran todas sus sesiones. Tendrás que entregarle la temporal por un canal seguro.' });
    if (ok === null) return;
    this.busy.set(true);
    try {
      this.temp.set(await this.api.resetPassword(u.id));
      this.sel.set(await this.api.user(u.id));
      void this.loadAccess(u.id, 1);
    } catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }

  async save(u: UserRow) {
    const b: Dict = {};
    if (this.edit.name.trim() && this.edit.name.trim() !== (u.name ?? '')) b['name'] = this.edit.name.trim();
    if (this.edit.email.trim() && this.edit.email.trim() !== (u.email ?? '')) b['email'] = this.edit.email.trim();
    if (this.edit.cedula && this.edit.cedula !== (u.cedula ?? '')) b['cedula'] = this.edit.cedula;
    if (!Object.keys(b).length) { this.toast.show('No hay cambios que guardar', 'info'); return; }
    await this.act(() => this.api.updateUser(u.id, b), 'Datos actualizados');
  }

  reasonLabel(r: string): string {
    return ({ wrong_password: 'Contraseña incorrecta', user_not_found: 'Cuenta inexistente', user_inactive: 'Cuenta desactivada',
      temp_password_expired: 'Contraseña temporal vencida', rate_limited: 'Demasiados intentos',
      staff_not_enabled: 'Colaborador sin acceso habilitado', google_token: 'Token de Google rechazado', google_sub_mismatch: 'Otra identidad de Google' } as Record<string, string>)[r] ?? r;
  }

  async copy(t: string) {
    try { await navigator.clipboard.writeText(t); this.toast.ok('Copiada al portapapeles'); } catch { this.toast.show('Selecciónala y cópiala manualmente', 'info'); }
  }
}
