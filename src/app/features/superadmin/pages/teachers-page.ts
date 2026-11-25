import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { FormsModule } from '@angular/forms';
import { COURSE_LABELS_SHORT } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { ROLE_LABELS, fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { Page, SaApi, TeacherAssignment, TeacherCatalog, TeacherDetail, TeacherMatch, TeacherPreview, TeacherPreviewRow, TeacherRow } from '../sa-api.service';

const MATCH: Record<TeacherMatch, { label: string; cls: string }> = {
  exacto: { label: 'Coincide', cls: 'ok' }, coincidencia: { label: 'Coincide (nombre parcial)', cls: 'ok' },
  aproximado: { label: 'Revisar: nombre parecido', cls: 'warn' }, ambiguo: { label: 'Elegir correo', cls: 'warn' },
  sin_correo: { label: 'Sin correo', cls: 'bad' }, anterior: { label: 'Correo ya guardado', cls: 'info' },
};
type ListFilter = 'activos' | 'sin_correo' | 'inactivos';
type PreviewFilter = 'revisar' | 'sin_correo' | 'todos';

/** Docentes: importación del distributivo con los correos de Google, lista y correo de cada uno. */
@Component({
  selector: 'app-sa-teachers',
  imports: [FormsModule, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Docentes</h1>
      <p class="lede">Cuentas de los docentes y las materias que tienen en cada curso y paralelo. Ingresan con su correo institucional de Google y solo ven las solicitudes de sus materias.</p></div>
      <div class="actions"><button type="button" class="btn btn-primary" (click)="openImport()">
        <span class="material-symbols-outlined" aria-hidden="true">upload_file</span>Importar distributivo</button></div></div>

    @if (data()?.lastImport; as li) {
      <p class="muted last">Última importación {{ ago(li.at) }}: {{ li.summary['importados'] ?? li.summary['docentes'] }} docentes, {{ li.summary['asignaciones'] }} materias por curso y paralelo.</p>
    }

    <form class="filters" (submit)="$event.preventDefault(); load(1)" role="search">
      <div class="field grow"><label class="field-label" for="tq">Buscar</label>
        <input id="tq" class="input" type="search" name="q" [(ngModel)]="q" placeholder="Nombre o correo" /></div>
      <div class="field"><label class="field-label" for="tst">Mostrar</label>
        <select id="tst" class="select" name="st" [(ngModel)]="status" (ngModelChange)="load(1)">
          <option value="activos">Activos</option>
          <option value="sin_correo">Sin correo{{ data() ? ' (' + data()!.totals.sinCorreo + ')' : '' }}</option>
          <option value="inactivos">Inactivos</option>
        </select></div>
    </form>

    @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }
    @if (data(); as d) {
      @if (d.rows.length) {
        <section class="section">
          <table class="dtable">
            <thead><tr><th>Docente</th><th class="num">Materias</th><th>Acceso</th><th><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              @for (t of d.rows; track t.id) {
                <tr>
                  <td><span class="strong">{{ t.name }}</span>
                    @if (t.email) { <span class="sub">{{ t.email }}</span> } @else { <span class="sub"><span class="tag bad">Sin correo</span></span> }</td>
                  <td class="num opt">{{ t.materias }}</td>
                  <td class="opt">{{ access(t) }}</td>
                  <td class="act"><button type="button" class="btn btn-outline btn-sm" (click)="openTeacher(t)">{{ t.email ? 'Ver' : 'Poner correo' }}</button></td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        @if (d.totalPages > 1) { <app-pager [page]="d.page" [pageSize]="d.pageSize" [total]="d.total" [totalPages]="d.totalPages" (go)="load($event)" /> }
      } @else {
        <div class="section"><app-empty icon="co_present" [title]="d.totals.activos ? 'No hay docentes con ese filtro' : 'Aún no hay docentes'"
          [text]="d.totals.activos ? 'Cambia la búsqueda o el filtro.' : 'Importa el distributivo y la lista de correos para crear sus cuentas.'" /></div>
      }
    } @else if (!error()) { <app-skeleton-rows [rows]="8" [cols]="3" /> }

    <!-- Importación -->
    <dialog #imp class="sheet wide" aria-labelledby="imp-title" (close)="closeImport()">
      <div class="sheet-head"><h2 id="imp-title">Importar distributivo</h2>
        <button type="button" class="icon-btn" (click)="imp.close()" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button></div>
      <div class="sheet-body">
        @if (result(); as r) {
          <p class="alert alert-success"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            Importación aplicada: {{ r['importados'] }} docentes y {{ r['asignaciones'] }} materias por curso y paralelo.</p>
          <dl class="kv">
            <dt>Cuentas nuevas</dt><dd>{{ $any(r['cuentas'])?.['creada'] ?? 0 }}</dd>
            <dt>Cuentas vinculadas</dt><dd>{{ $any(r['cuentas'])?.['vinculada'] ?? 0 }}</dd>
            <dt>Sin correo</dt><dd>{{ $any(r['cuentas'])?.['sin_correo'] ?? 0 }}</dd>
            <dt>No incluidos</dt><dd>{{ r['excluidos'] }}</dd>
            <dt>Docentes inactivados</dt><dd>{{ r['inactivados'] }}</dd>
          </dl>
          <div class="form-actions"><button type="button" class="btn btn-primary" (click)="imp.close()">Listo</button></div>
        } @else if (preview(); as p) {
          <div class="chips">
            <span class="chip-n"><b class="tnum">{{ p.summary['docentes'] }}</b> docentes</span>
            <span class="chip-n"><b class="tnum">{{ p.summary['asignaciones'] }}</b> materias por curso y paralelo</span>
            <span class="chip-n ok"><b class="tnum">{{ p.summary['conCorreo'] }}</b> con correo</span>
            <span class="chip-n warn"><b class="tnum">{{ review().length }}</b> por revisar</span>
            <span class="chip-n bad"><b class="tnum">{{ p.summary['sin_correo'] }}</b> sin correo</span>
          </div>
          <p class="muted small">Se leyó solo la hoja BD2 del distributivo. {{ p.summary['excluidas'] }} filas de materias no evaluables (comportamental, convivencia) no se asignan.</p>
          <div class="tabs" role="tablist" aria-label="Filtrar vista previa">
            <button type="button" role="tab" [attr.aria-selected]="pf() === 'revisar'" (click)="pf.set('revisar')">Por revisar ({{ review().length }})</button>
            <button type="button" role="tab" [attr.aria-selected]="pf() === 'sin_correo'" (click)="pf.set('sin_correo')">Sin correo ({{ p.summary['sin_correo'] }})</button>
            <button type="button" role="tab" [attr.aria-selected]="pf() === 'todos'" (click)="pf.set('todos')">Todos ({{ p.teachers.length }})</button>
          </div>
          @if (shown().length) {
            <table class="dtable prev">
              <thead><tr><th class="ck">Incluir</th><th>Docente</th><th>Correo</th><th class="num">Materias</th></tr></thead>
              <tbody>
                @for (t of shown(); track t.nameKey) {
                  <tr [class.off]="!included(t)">
                    <td class="ck"><input type="checkbox" class="cbox" [checked]="included(t)" (change)="toggleInclude(t)" [attr.aria-label]="'Incluir a ' + t.name" /></td>
                    <td><span class="strong">{{ t.name }}</span><span class="sub"><span class="tag" [class]="'tag ' + match[t.match].cls">{{ match[t.match].label }}</span></span></td>
                    <td>
                      @if (t.match === 'ambiguo') {
                        <select class="select" [ngModel]="emailFor(t)" (ngModelChange)="setEmail(t, $event)" [attr.aria-label]="'Correo de ' + t.name">
                          <option value="">Elegir…</option>
                          @for (c of t.candidates; track c) { <option [value]="c">{{ c }}</option> }
                        </select>
                      } @else if (t.match === 'sin_correo' || editing().has(t.nameKey)) {
                        <input class="input" type="email" [ngModel]="emailFor(t)" (ngModelChange)="setEmail(t, $event)" placeholder="nombre@uets.edu.ec"
                               [attr.aria-label]="'Correo de ' + t.name" />
                      } @else {
                        <span>{{ t.email }}</span> <button type="button" class="link" (click)="editEmail(t)">Cambiar</button>
                      }
                    </td>
                    <td class="num">{{ t.materias }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else { <app-empty icon="task_alt" title="Nada por revisar" text="Todos los docentes tienen un correo que coincide." /> }
          <p class="muted small">Los docentes sin correo se pueden incluir: quedan con sus materias y no podrán ingresar hasta que les pongas el correo. Los que no incluyas no se crean y sus materias quedan sin docente.</p>
          @if (impError()) { <p class="alert alert-error" role="alert">{{ impError() }}</p> }
          <div class="form-actions">
            <button type="button" class="btn btn-text" (click)="preview.set(null)">Volver</button>
            <button type="button" class="btn btn-primary" (click)="confirm()" [disabled]="busy()">{{ busy() ? 'Importando…' : 'Importar ' + includedCount() + ' docentes' }}</button>
          </div>
        } @else {
          <p>Sube los dos archivos. Primero verás una vista previa: nada se guarda hasta que confirmes.</p>
          <div class="field"><label class="field-label" for="f-dist">Distributivo (Profesores - Materias)</label>
            <input id="f-dist" class="input" type="file" accept=".xlsx" (change)="pick('dist', $event)" />
            <span class="field-hint">Se lee solo la hoja BD2 (Etapa, Especialidad, Curso, Grupo, Materia, Profesor). La hoja con datos de estudiantes no se usa.</span></div>
          <div class="field"><label class="field-label" for="f-mail">Correos de los docentes</label>
            <input id="f-mail" class="input" type="file" accept=".xlsx" (change)="pick('mail', $event)" />
            <span class="field-hint">Exportación de usuarios de Google Workspace (First Name, Last Name, Email Address).</span></div>
          @if (impError()) { <p class="alert alert-error" role="alert">{{ impError() }}</p> }
          <div class="form-actions">
            <button type="button" class="btn btn-primary" (click)="runPreview()" [disabled]="busy() || !dist || !mail">{{ busy() ? 'Leyendo…' : 'Ver vista previa' }}</button>
          </div>
        }
      </div>
    </dialog>

    <!-- Ficha del docente -->
    <dialog #det class="sheet" aria-labelledby="t-title" (close)="sel.set(null)">
      @if (sel(); as t) {
        <div class="sheet-head"><h2 id="t-title">{{ t.name }}</h2>
          <button type="button" class="icon-btn" (click)="det.close()" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button></div>
        <div class="sheet-body">
          <form class="block" (submit)="$event.preventDefault(); saveEmail(t)">
            <label class="field"><span class="field-label">Correo institucional</span>
              <input class="input" type="email" name="em" [(ngModel)]="emailDraft" placeholder="nombre@uets.edu.ec" /></label>
            <span class="field-hint">{{ t.hasAccount ? 'Ingresa con este correo de Google. Si lo cambias, su sesión abierta se cierra.' : 'Al guardar el correo se crea su cuenta y ya puede ingresar con Google.' }}</span>
            <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !emailDraft || emailDraft === t.email">Guardar correo</button></div>
          </form>
          <section class="block">
            <h3>Cuenta</h3>
            @if (t.account; as acc) {
              <dl class="kv">
                <dt>Rol</dt><dd>{{ roleLabels[acc.role] ?? acc.role }}{{ acc.isActive ? '' : ' · desactivada' }}</dd>
                <dt>Último ingreso</dt><dd>{{ acc.lastLoginAt ? dt(acc.lastLoginAt) : 'Aún no ha ingresado' }}</dd>
                @if (t.manual) { <dt>Origen</dt><dd>Rol de docente asignado a mano (no viene del distributivo)</dd> }
              </dl>
              @if (acc.role !== 'TEACHER') {
                <p class="alert alert-info"><span class="material-symbols-outlined" aria-hidden="true">info</span>
                  Esta cuenta tiene rol {{ roleLabels[acc.role] ?? acc.role }}: no entra al panel docente hasta que se le dé el rol de docente.</p>
              }
              <div class="row">
                <select class="select" [(ngModel)]="roleDraft" aria-label="Rol de la cuenta">
                  <option value="TEACHER">Docente</option><option value="ADMIN">Administrador</option>
                </select>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="busy() || roleDraft === acc.role" (click)="changeRole(t)">Cambiar rol</button>
              </div>
            } @else { <p class="muted">Sin cuenta: guarda su correo institucional para crearla.</p> }
          </section>
          <section class="block">
            <h3>Materias asignadas ({{ t.assignments.length }})</h3>
            @if (t.assignments.length) {
              <ul class="asg">
                @for (a of t.assignments; track $index) {
                  <li><span>{{ a.subject }}@if (a.manual) { <span class="tag" title="Agregada a mano: una nueva importación no la quita">a mano</span> }</span>
                    <span class="r"><small>{{ short(a.course) }} {{ a.paralelo }}</small>
                      <button type="button" class="icon-btn sm" [disabled]="busy()" (click)="removeAsg(t, a)" [attr.aria-label]="'Quitar ' + a.subject + ' de ' + short(a.course) + ' ' + a.paralelo">
                        <span class="material-symbols-outlined" aria-hidden="true">close</span></button></span></li>
                }
              </ul>
            } @else { <p class="muted">Sin materias asignadas.</p> }
            <form class="addasg" (submit)="$event.preventDefault(); addAsg(t)">
              <div class="field"><label class="field-label" for="a-c">Curso</label>
                <select id="a-c" class="select" name="ac" [(ngModel)]="asg.course" (ngModelChange)="asg.paralelo = ''; asg.subject = ''">
                  <option value="">Elegir…</option>
                  @for (c of catalog(); track c.course) { <option [value]="c.course">{{ short(c.course) }}</option> }
                </select></div>
              <div class="field"><label class="field-label" for="a-p">Paralelo</label>
                <select id="a-p" class="select" name="ap" [(ngModel)]="asg.paralelo" (ngModelChange)="asg.subject = ''" [disabled]="!asg.course">
                  <option value="">Elegir…</option>
                  @for (p of paralelos(); track p.code) { <option [value]="p.code">{{ p.code }}{{ p.specialty ? ' · ' + p.specialty : '' }}</option> }
                </select></div>
              <div class="field grow"><label class="field-label" for="a-s">Materia</label>
                <select id="a-s" class="select" name="as" [(ngModel)]="asg.subject" [disabled]="!asg.paralelo">
                  <option value="">Elegir…</option>
                  @for (m of materias(); track m) { <option [value]="m">{{ m === testSubject ? m + ' — solo para pruebas' : m }}</option> }
                </select></div>
              <div class="fa"><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !asg.subject">
                <span class="material-symbols-outlined" aria-hidden="true">save</span>{{ busy() ? 'Guardando…' : 'Guardar materia' }}</button></div>
            </form>
            <span class="field-hint">Elige curso, paralelo y materia, y pulsa <b>Guardar materia</b>. Lo agregado a mano se conserva aunque se vuelva a importar el distributivo.
              Para pruebas usa <b>{{ testSubject }}</b>: no es una materia real y solo la pueden pedir los estudiantes marcados como "cuenta de prueba" (en su ficha).</span>
          </section>
        </div>
      }
    </dialog>
  `,
  styles: `
    .last { margin: -6px 0 0; font: var(--body-md); }
    .act { text-align: right; white-space: nowrap; }
    dialog.sheet.wide { width: min(880px, 100vw); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip-n { padding: 6px 10px; border-radius: 8px; background: var(--surface-container-low); font: var(--label-md); }
    .chip-n.ok { background: var(--success-container); color: var(--on-success-container); }
    .chip-n.warn { background: var(--warning-container); color: #4a2c00; }
    .chip-n.bad { background: var(--error-container); color: var(--on-error-container); }
    .small { font-size: 0.8125rem; margin: 0; }
    .prev .ck, .ck { width: 64px; }
    .prev .input, .prev .select { min-height: 34px; padding-block: 4px; width: 100%; }
    .prev tr.off td { color: var(--on-surface-variant); }
    .prev tr.off .strong { text-decoration: line-through; font-weight: 500; }
    .cbox { width: 18px; height: 18px; accent-color: var(--primary-container); }
    .link { border: 0; background: none; padding: 0 0 0 6px; color: var(--primary-container); font: var(--label-md); cursor: pointer; text-decoration: underline; }
    .block { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--outline-variant); }
    .block:first-child { border-top: 0; padding-top: 0; }
    .block h3 { font: var(--title-md); }
    .asg { list-style: none; margin: 0; padding: 0; display: grid; }
    .asg li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--surface-container-high); }
    .asg small { color: var(--on-surface-variant); white-space: nowrap; }
    .asg .r { display: inline-flex; align-items: center; gap: 6px; }
    .asg .tag { margin-left: 8px; }
    .icon-btn.sm { width: 28px; height: 28px; }
    .icon-btn.sm .material-symbols-outlined { font-size: 18px; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .row .select { flex: 1 1 200px; width: auto; }
    .addasg { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
    .addasg .field { min-width: 120px; }
    .addasg .grow { flex: 1 1 200px; }
    .addasg .fa { padding-bottom: 2px; }
  `,
})
export class TeachersPage {
  private readonly api = inject(SaApi);
  private readonly toast = inject(ToastService);
  private readonly imp = viewChild.required<ElementRef<HTMLDialogElement>>('imp');
  private readonly det = viewChild.required<ElementRef<HTMLDialogElement>>('det');
  readonly match = MATCH;
  readonly ago = fmtAgo;
  readonly dt = fmtDateTime;
  readonly data = signal<(Page<TeacherRow> & { totals: { activos: number; sinCorreo: number }; lastImport: { at: string; summary: Record<string, unknown> } | null }) | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  q = '';
  status: ListFilter = 'activos';

  // importación
  dist: File | null = null;
  mail: File | null = null;
  readonly preview = signal<TeacherPreview | null>(null);
  readonly result = signal<Record<string, unknown> | null>(null);
  readonly impError = signal<string | null>(null);
  readonly pf = signal<PreviewFilter>('revisar');
  readonly emails = signal<Record<string, string>>({});
  readonly exclude = signal<Set<string>>(new Set());
  readonly editing = signal<Set<string>>(new Set());
  readonly review = computed(() => (this.preview()?.teachers ?? []).filter((t) => ['aproximado', 'ambiguo', 'coincidencia'].includes(t.match)));
  readonly shown = computed(() => {
    const all = this.preview()?.teachers ?? [];
    const f = this.pf();
    return f === 'todos' ? all : f === 'sin_correo' ? all.filter((t) => t.match === 'sin_correo') : this.review();
  });
  readonly includedCount = computed(() => (this.preview()?.teachers ?? []).filter((t) => !this.exclude().has(t.nameKey)).length);

  // ficha
  private readonly confirmSvc = inject(ConfirmService);
  readonly roleLabels: Record<string, string> = ROLE_LABELS;
  readonly sel = signal<TeacherDetail | null>(null);
  readonly catalog = signal<TeacherCatalog[]>([]);
  emailDraft = '';
  roleDraft = 'TEACHER';
  readonly testSubject = 'Materia de prueba (sistema)';
  asg = { course: '', paralelo: '', subject: '' };
  paralelos() { return this.catalog().find((c) => c.course === this.asg.course)?.paralelos ?? []; }
  materias() { return this.paralelos().find((p) => p.code === this.asg.paralelo)?.subjects ?? []; }

  constructor() { void this.load(1); }

  async load(page: number) {
    this.error.set(null);
    try { this.data.set(await this.api.teachers({ q: this.q, status: this.status, page })); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar los docentes.')); }
  }

  access(t: TeacherRow): string {
    if (!t.email) return 'No puede ingresar (sin correo)';
    return t.lastLoginAt ? `Último ingreso ${fmtAgo(t.lastLoginAt)}` : 'Aún no ha ingresado';
  }
  short(c: string): string { return COURSE_LABELS_SHORT[c] ?? c; }

  openImport() {
    this.dist = this.mail = null;
    this.preview.set(null); this.result.set(null); this.impError.set(null);
    this.imp().nativeElement.showModal();
  }
  closeImport() { if (this.result()) void this.load(1); }
  pick(which: 'dist' | 'mail', ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    if (which === 'dist') this.dist = f; else this.mail = f;
  }

  async runPreview() {
    if (!this.dist || !this.mail) return;
    this.busy.set(true); this.impError.set(null);
    try {
      const p = await this.api.teacherPreview(this.dist, this.mail);
      this.emails.set({});
      this.editing.set(new Set());
      // Por defecto no se incluyen los que no tienen correo (pueden marcarse a mano).
      this.exclude.set(new Set(p.teachers.filter((t) => !t.email).map((t) => t.nameKey)));
      this.pf.set(p.teachers.some((t) => ['aproximado', 'ambiguo', 'coincidencia'].includes(t.match)) ? 'revisar' : 'sin_correo');
      this.preview.set(p);
    } catch (e) { this.impError.set(apiMessage(e, 'No se pudieron leer los archivos.')); }
    finally { this.busy.set(false); }
  }

  included(t: TeacherPreviewRow) { return !this.exclude().has(t.nameKey); }
  toggleInclude(t: TeacherPreviewRow) {
    this.exclude.update((s) => { const n = new Set(s); if (n.has(t.nameKey)) n.delete(t.nameKey); else n.add(t.nameKey); return n; });
  }
  emailFor(t: TeacherPreviewRow) { return this.emails()[t.nameKey] ?? (t.match === 'ambiguo' ? '' : t.email ?? ''); }
  setEmail(t: TeacherPreviewRow, v: string) {
    this.emails.update((m) => ({ ...m, [t.nameKey]: v.trim() }));
    if (v.trim() && this.exclude().has(t.nameKey)) this.toggleInclude(t);
  }
  editEmail(t: TeacherPreviewRow) { this.editing.update((s) => new Set(s).add(t.nameKey)); }

  async confirm() {
    const p = this.preview();
    if (!p) return;
    this.busy.set(true); this.impError.set(null);
    try {
      const emails = Object.fromEntries(Object.entries(this.emails()).filter(([, v]) => v));
      this.result.set(await this.api.teacherConfirm(p.draftId, emails, [...this.exclude()]));
      this.toast.ok('Docentes importados');
    } catch (e) { this.impError.set(apiMessage(e, 'No se pudo aplicar la importación.')); }
    finally { this.busy.set(false); }
  }

  async openTeacher(t: TeacherRow) {
    try {
      const d = await this.api.teacher(t.id);
      this.sel.set(d);
      this.emailDraft = d.email ?? '';
      this.roleDraft = d.account?.role ?? 'TEACHER';
      this.asg = { course: '', paralelo: '', subject: '' };
      if (!this.catalog().length) this.api.teacherCatalog().then((c) => this.catalog.set(c), () => undefined);
      this.det().nativeElement.showModal();
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo abrir la ficha.')); }
  }

  async saveEmail(t: TeacherDetail) {
    this.busy.set(true);
    try {
      const r = await this.api.setTeacherEmail(t.id, this.emailDraft);
      this.toast.ok(r.account === 'creada' ? 'Correo guardado: ya puede ingresar con Google' : 'Correo guardado');
      this.sel.set(await this.api.teacher(t.id));
      void this.load(this.data()?.page ?? 1);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo guardar el correo.')); }
    finally { this.busy.set(false); }
  }

  async changeRole(t: TeacherDetail) {
    const acc = t.account;
    if (!acc) return;
    const to = this.roleDraft;
    const reason = await this.confirmSvc.ask({
      title: `Cambiar rol a ${ROLE_LABELS[to] ?? to}`, confirmLabel: 'Cambiar rol', reasonMin: 10,
      risk: to === 'TEACHER' ? 'Entrará al panel docente y verá solo las solicitudes de sus materias. Sus sesiones abiertas se cierran.'
        : 'Entrará al panel de administración y dejará el panel docente. Sus sesiones abiertas se cierran.',
    });
    if (reason === null) return;
    this.busy.set(true);
    try {
      await this.api.changeRole(acc.id, to, reason);
      this.toast.ok('Rol actualizado');
      this.sel.set(await this.api.teacher(t.id));
      void this.load(this.data()?.page ?? 1);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo cambiar el rol.')); }
    finally { this.busy.set(false); }
  }

  async addAsg(t: TeacherDetail) {
    this.busy.set(true);
    try {
      this.sel.set(await this.api.addAssignment(t.id, this.asg));
      this.toast.ok(`Materia agregada: ${this.asg.subject} · ${this.short(this.asg.course)} ${this.asg.paralelo}`);
      this.asg = { ...this.asg, subject: '' };
      void this.load(this.data()?.page ?? 1);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo agregar la materia.')); }
    finally { this.busy.set(false); }
  }

  async removeAsg(t: TeacherDetail, a: TeacherAssignment) {
    const ok = await this.confirmSvc.ask({ title: `Quitar ${a.subject} de ${this.short(a.course)} ${a.paralelo}`, confirmLabel: 'Quitar',
      risk: 'El docente deja de ver las solicitudes de esa materia. El seguimiento que ya registró se conserva.' });
    if (ok === null) return;
    this.busy.set(true);
    try {
      this.sel.set(await this.api.removeAssignment(t.id, a));
      this.toast.ok('Materia quitada');
      void this.load(this.data()?.page ?? 1);
    } catch (e) { this.toast.error(apiMessage(e, 'No se pudo quitar la materia.')); }
    finally { this.busy.set(false); }
  }
}
