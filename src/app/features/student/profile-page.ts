import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { COURSE_CODES, COURSE_LABELS_LONG, SPECIALTY_NAMES, isBach, paralelosFor } from '../../core/catalogs';
import { apiMessage } from '../../core/utils/errors';
import { onlyLetters, toTitleCase, validateEcuadorianDni } from '../../core/utils/validators';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { Locks, MeApi, Rep } from './me-api.service';

type Tab = 'estudiante' | 'representante';
const PHONE = /^0\d{8,9}$/;

/** Divide un nombre completo guardado antes del formulario actual: los dos últimos términos son los apellidos. */
function split(full: string | null | undefined): { first: string; last: string } {
  const w = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return w.length >= 3 ? { first: w.slice(0, -2).join(' '), last: w.slice(-2).join(' ') } : { first: w.join(' '), last: '' };
}

/**
 * Registro de datos del estudiante en dos pestañas: 1) sus datos y 2) su representante.
 * Todo se guarda cifrado; el servidor vuelve a validar curso, paralelo y especialidad.
 */
@Component({
  selector: 'app-profile-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Mis datos</h1>
      <p class="lede">Los usamos para llenar tus solicitudes y el comprobante oficial. Se guardan cifrados y solo el personal autorizado puede verlos.</p></div></div>

    <div class="tabs steps" role="tablist" aria-label="Pasos del registro">
      <button type="button" role="tab" id="tab-est" aria-controls="panel-est" [attr.aria-selected]="tab() === 'estudiante'" (click)="tab.set('estudiante')">
        <span class="num" [class.done]="hasProfile()" aria-hidden="true">{{ hasProfile() ? '✓' : '1' }}</span>Datos del estudiante
      </button>
      <button type="button" role="tab" id="tab-rep" aria-controls="panel-rep" [attr.aria-selected]="tab() === 'representante'"
              [disabled]="!hasProfile()" (click)="tab.set('representante')" [attr.title]="hasProfile() ? null : 'Primero guarda tus datos'">
        <span class="num" [class.done]="hasPrimary()" aria-hidden="true">{{ hasPrimary() ? '✓' : '2' }}</span>Datos del representante
      </button>
    </div>

    @if (loading()) {
      <div class="section"><div class="body"><span class="skeleton" style="height:220px;display:block"></span></div></div>
    } @else if (tab() === 'estudiante') {
      <section class="section" id="panel-est" role="tabpanel" aria-labelledby="tab-est">
        <header><h2>Datos del estudiante</h2><span class="end muted">{{ email() }}</span></header>
        @if (locks().student) {
          <div class="body ro">
            <dl class="kv">
              <dt>Nombres</dt><dd>{{ p.firstNames }}</dd><dt>Apellidos</dt><dd>{{ p.lastNames }}</dd>
              <dt>Número de cédula</dt><dd class="tnum">{{ p.cedula }}</dd><dt>Curso</dt><dd>{{ courseLabels[p.course] }}</dd>
              @if (p.specialty) { <dt>Especialidad</dt><dd>{{ p.specialty }}</dd> }
              <dt>{{ p.specialty ? 'Curso de la especialidad' : 'Paralelo' }}</dt><dd>{{ p.paralelo }}</dd>
            </dl>
            <p class="alert alert-info wide" role="status"><span class="material-symbols-outlined" aria-hidden="true">lock</span>
            <span>Estos datos ya están registrados y no se pueden cambiar desde tu cuenta. Si necesitas corregirlos, acércate al <strong>Departamento de Sistemas</strong> para que habiliten la edición.</span></p>
          </div>
        } @else {
        @if (hasProfile()) {
          <p class="alert alert-warning unlock-note" role="status"><span class="material-symbols-outlined" aria-hidden="true">lock_open</span>
            <span>El Departamento de Sistemas habilitó la corrección de tus datos. Al guardar, quedarán bloqueados de nuevo.</span></p>
        }
        <form class="body form-grid" (submit)="$event.preventDefault(); saveProfile()" novalidate>
          <label class="field"><span class="field-label">Nombres</span>
            <input class="input" name="fn" [ngModel]="p.firstNames" (ngModelChange)="p.firstNames = onlyLetters($event)" (blur)="p.firstNames = title(p.firstNames)"
                   autocomplete="given-name" maxlength="60" required placeholder="Ej.: María José" aria-describedby="fn-hint" />
            <span class="field-hint" id="fn-hint">Uno o más nombres.</span></label>
          <label class="field"><span class="field-label">Apellidos</span>
            <input class="input" name="ln" [ngModel]="p.lastNames" (ngModelChange)="p.lastNames = onlyLetters($event)" (blur)="p.lastNames = title(p.lastNames)"
                   autocomplete="family-name" maxlength="60" required placeholder="Ej.: Pérez López" aria-describedby="ln-hint" />
            <span class="field-hint" id="ln-hint">Escribe tus dos apellidos.</span></label>
          <label class="field"><span class="field-label">Número de cédula</span>
            <input class="input tnum" name="ced" [ngModel]="p.cedula" (ngModelChange)="p.cedula = digits($event)" inputmode="numeric" maxlength="10" required
                   [disabled]="locked()" [class.invalid]="p.cedula.length === 10 && !ced(p.cedula)" />
            @if (p.cedula.length === 10 && !ced(p.cedula)) { <span class="field-error">Revisa la cédula: no es válida.</span> }
            @if (locked()) { <span class="field-hint">Ya tienes solicitudes: para cambiarla pide ayuda a la institución.</span> }</label>
          <label class="field"><span class="field-label">Curso</span>
            <select class="select" name="course" [ngModel]="p.course" (ngModelChange)="setCourse($event)" required>
              <option value="" disabled>Elige tu curso</option>
              @for (c of courses; track c) { <option [value]="c">{{ courseLabels[c] }}</option> }
            </select></label>
          @if (bach()) {
            <label class="field"><span class="field-label">Especialidad</span>
              <select class="select" name="spec" [ngModel]="p.specialty" (ngModelChange)="setSpecialty($event)" required>
                <option value="" disabled>Elige tu especialidad</option>
                @for (s of specialties; track s) { <option [value]="s">{{ s }}</option> }
              </select></label>
          }
          <label class="field"><span class="field-label">{{ bach() ? 'Curso de la especialidad' : 'Paralelo' }}</span>
            <select class="select" name="par" [(ngModel)]="p.paralelo" required [disabled]="!paralelos().length">
              <option value="" disabled>{{ !p.course ? 'Primero elige el curso' : bach() && !p.specialty ? 'Primero elige la especialidad' : 'Elige' }}</option>
              @for (x of paralelos(); track x) { <option [value]="x">{{ x }}</option> }
            </select></label>
          @if (pErr()) { <p class="alert alert-error wide" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ pErr() }}</p> }
          <div class="form-actions wide">
            <button type="submit" class="btn btn-primary" [disabled]="busy()">
              {{ busy() ? 'Guardando…' : hasProfile() ? 'Guardar cambios' : 'Guardar y continuar' }}
              @if (!hasProfile()) { <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span> }
            </button>
          </div>
        </form>
        }
      </section>
    } @else {
      <section class="section" id="panel-rep" role="tabpanel" aria-labelledby="tab-rep">
        <header><h2>Datos del representante</h2><span class="end muted">Aparece en tus solicitudes y en el comprobante</span></header>
        @if (locks().representative && primary(); as rp) {
          <div class="body ro">
            <dl class="kv">
              <dt>Nombres</dt><dd>{{ r.firstNames }}</dd><dt>Apellidos</dt><dd>{{ r.lastNames }}</dd>
              <dt>Número de cédula</dt><dd class="tnum">{{ rp.cedula }}</dd><dt>Correo personal</dt><dd>{{ rp.email || '—' }}</dd>
              <dt>Celular</dt><dd class="tnum">{{ rp.phone }}</dd>
            </dl>
            <p class="alert alert-info wide" role="status"><span class="material-symbols-outlined" aria-hidden="true">lock</span>
            <span>Estos datos ya están registrados y no se pueden cambiar desde tu cuenta. Si necesitas corregirlos, acércate al <strong>Departamento de Sistemas</strong> para que habiliten la edición.</span></p>
          </div>
        } @else {
        @if (primary()) {
          <p class="alert alert-warning unlock-note" role="status"><span class="material-symbols-outlined" aria-hidden="true">lock_open</span>
            <span>El Departamento de Sistemas habilitó la corrección del representante. Al guardar, quedará bloqueado de nuevo.</span></p>
        }
        <form class="body form-grid" (submit)="$event.preventDefault(); saveRep()" novalidate>
          @if (primary() && !replacing()) {
            <p class="wide note">Representante registrado: <strong>{{ primary()!.names }}</strong>. Puedes corregir sus datos; para registrar a otra persona usa «Cambiar de representante».</p>
          }
          <label class="field"><span class="field-label">Nombres</span>
            <input class="input" name="rfn" [ngModel]="r.firstNames" (ngModelChange)="r.firstNames = onlyLetters($event)" (blur)="r.firstNames = title(r.firstNames)" maxlength="60" required /></label>
          <label class="field"><span class="field-label">Apellidos</span>
            <input class="input" name="rln" [ngModel]="r.lastNames" (ngModelChange)="r.lastNames = onlyLetters($event)" (blur)="r.lastNames = title(r.lastNames)" maxlength="60" required
                   aria-describedby="rln-hint" /><span class="field-hint" id="rln-hint">Sus dos apellidos.</span></label>
          <label class="field"><span class="field-label">Número de cédula</span>
            <input class="input tnum" name="rced" [ngModel]="r.cedula" (ngModelChange)="r.cedula = digits($event)" inputmode="numeric" maxlength="10" required
                   [disabled]="!!primary() && !replacing()" [class.invalid]="r.cedula.length === 10 && !ced(r.cedula)" />
            @if (r.cedula.length === 10 && !ced(r.cedula)) { <span class="field-error">Revisa la cédula: no es válida.</span> }</label>
          <label class="field"><span class="field-label">Correo personal</span>
            <input class="input" type="email" name="rmail" [(ngModel)]="r.email" autocomplete="off" required placeholder="nombre@gmail.com"
                   aria-describedby="rmail-hint" /><span class="field-hint" id="rmail-hint">El correo que usa el representante (Gmail, Hotmail, Outlook…).</span></label>
          <label class="field"><span class="field-label">Celular</span>
            <input class="input tnum" name="rphone" [ngModel]="r.phone" (ngModelChange)="r.phone = digits($event)" inputmode="tel" maxlength="10" placeholder="09xxxxxxxx" required /></label>
          @if (rErr()) { <p class="alert alert-error wide" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ rErr() }}</p> }
          @if (rNote()) { <p class="alert alert-info wide" role="status"><span class="material-symbols-outlined" aria-hidden="true">info</span>{{ rNote() }}</p> }
          <div class="form-actions wide">
            @if (primary() && !replacing()) {
              <button type="button" class="btn btn-text" (click)="startReplace()">Cambiar de representante</button>
            } @else if (replacing()) {
              <button type="button" class="btn btn-text" (click)="cancelReplace()">Cancelar</button>
            }
            <button type="submit" class="btn btn-primary" [disabled]="busy()">
              {{ busy() ? 'Guardando…' : primary() && !replacing() ? 'Guardar cambios' : 'Guardar representante' }}</button>
          </div>
        </form>
        }
      </section>
    }

    @if (hasPrimary() && !loading()) {
      <div class="alert alert-success" role="status"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
        <span>Todo listo. Ya puedes enviar solicitudes.</span>
        <span class="alert-actions"><button type="button" class="btn btn-gold btn-sm" (click)="go()">Nueva solicitud</button></span></div>
    }
  `,
  styles: `
    .steps button { display: inline-flex; align-items: center; gap: 8px; }
    .steps button:disabled { opacity: 0.55; cursor: not-allowed; }
    .num { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-container-highest); font: var(--label-sm); }
    [aria-selected='true'] .num { background: var(--primary); color: #fff; }
    .num.done { background: #1b7a43; color: #fff; }
    .wide { grid-column: 1 / -1; }
    .note { color: var(--on-surface-variant); }
    .ro { display: grid; gap: 16px; }
    .unlock-note { margin: 14px 18px 0; }
  `,
})
export class ProfilePage {
  private readonly api = inject(MeApi);
  readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly courses = COURSE_CODES;
  readonly courseLabels = COURSE_LABELS_LONG;
  readonly specialties = SPECIALTY_NAMES;
  readonly ced = validateEcuadorianDni;
  readonly onlyLetters = onlyLetters;
  readonly title = toTitleCase;
  readonly tab = signal<Tab>('estudiante');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly email = signal('');
  readonly reps = signal<Rep[]>([]);
  readonly hasProfile = signal(false);
  readonly locked = signal(false);
  readonly replacing = signal(false);
  readonly locks = signal<Locks>({ student: false, representative: false });
  readonly pErr = signal<string | null>(null);
  readonly rErr = signal<string | null>(null);
  readonly rNote = signal<string | null>(null);
  /** Curso y especialidad como señales: de ellos dependen los paralelos disponibles. */
  private readonly courseSig = signal('');
  private readonly specialtySig = signal('');
  readonly bach = computed(() => isBach(this.courseSig()));
  readonly paralelos = computed(() => paralelosFor(this.courseSig(), this.specialtySig()));
  readonly primary = computed(() => this.reps().find((x) => x.isPrimary) ?? null);
  readonly hasPrimary = computed(() => this.hasProfile() && !!this.primary());
  p = { firstNames: '', lastNames: '', cedula: '', course: '', specialty: '', paralelo: '' };
  r = { firstNames: '', lastNames: '', cedula: '', email: '', phone: '' };

  constructor() { void this.load(); }

  digits(v: string) { return (v ?? '').replace(/\D/g, '').slice(0, 10); }

  setCourse(c: string) {
    this.p.course = c;
    this.courseSig.set(c);
    if (!isBach(c)) { this.p.specialty = ''; this.specialtySig.set(''); }
    if (!this.paralelos().includes(this.p.paralelo)) this.p.paralelo = '';
  }

  setSpecialty(s: string) {
    this.p.specialty = s;
    this.specialtySig.set(s);
    if (!this.paralelos().includes(this.p.paralelo)) this.p.paralelo = '';
  }

  private fillRep(rep: Rep | null) {
    const sp = split(rep?.names);
    this.r = rep
      ? { firstNames: rep.firstNames ?? sp.first, lastNames: rep.lastNames ?? sp.last, cedula: rep.cedula, email: rep.email ?? '', phone: rep.phone ?? '' }
      : { firstNames: '', lastNames: '', cedula: '', email: '', phone: '' };
  }

  async load() {
    try {
      const x = await this.api.profile();
      this.email.set(x.email);
      this.reps.set(x.representatives);
      this.locks.set(x.locks);
      if (x.profile) {
        const pr = x.profile;
        const sp = split(pr.names);
        this.hasProfile.set(true);
        this.p = { firstNames: pr.firstNames ?? sp.first, lastNames: pr.lastNames ?? sp.last, cedula: pr.cedula ?? '', course: pr.course ?? '',
          specialty: pr.specialty ?? '', paralelo: pr.paralelo ?? '' };
        this.courseSig.set(this.p.course);
        this.specialtySig.set(this.p.specialty);
        if (!this.paralelos().includes(this.p.paralelo)) this.p.paralelo = '';
      }
      this.fillRep(this.primary());
      if (x.profile && !this.primary()) this.tab.set('representante');
      const reqs = await this.api.requests().catch(() => ({ data: [] }));
      this.locked.set(reqs.data.length > 0);
      this.session.markProfileCompleted(this.hasPrimary());
    } catch (e) { this.toast.error(apiMessage(e, 'No pudimos cargar tus datos.')); }
    finally { this.loading.set(false); }
  }

  async saveProfile() {
    this.pErr.set(null);
    const p = this.p;
    if (!p.firstNames.trim() || p.lastNames.trim().split(/\s+/).length < 2) { this.pErr.set('Escribe tus nombres y tus dos apellidos.'); return; }
    if (!this.ced(p.cedula)) { this.pErr.set('Revisa la cédula: no es válida.'); return; }
    if (!p.course) { this.pErr.set('Elige tu curso.'); return; }
    if (this.bach() && !p.specialty) { this.pErr.set('Elige tu especialidad.'); return; }
    if (!p.paralelo) { this.pErr.set(this.bach() ? 'Elige el curso de tu especialidad.' : 'Elige tu paralelo.'); return; }
    if (!(await this.confirmFinal('tus datos'))) return;
    this.busy.set(true);
    try {
      const body: Record<string, unknown> = { firstNames: toTitleCase(p.firstNames.trim()), lastNames: toTitleCase(p.lastNames.trim()),
        cedula: p.cedula, course: p.course, paralelo: p.paralelo };
      if (this.bach()) body['specialty'] = p.specialty;
      const x = await this.api.saveProfile(body);
      this.locks.set(x.locks);
      const first = !this.hasProfile();
      this.hasProfile.set(true);
      this.reps.set(x.representatives);
      const u = this.session.user();
      if (u) this.session.user.set({ ...u, name: x.profile.names, profileCompleted: x.profile.completed });
      this.toast.ok('Datos guardados');
      if (first || !this.primary()) this.tab.set('representante');
    } catch (e) { this.pErr.set(apiMessage(e, 'No pudimos guardar tus datos.')); }
    finally { this.busy.set(false); }
  }

  startReplace() { this.replacing.set(true); this.rErr.set(null); this.rNote.set(null); this.fillRep(null); }
  cancelReplace() { this.replacing.set(false); this.rErr.set(null); this.fillRep(this.primary()); }

  async saveRep() {
    this.rErr.set(null);
    this.rNote.set(null);
    const r = this.r;
    if (!r.firstNames.trim() || r.lastNames.trim().split(/\s+/).length < 2) { this.rErr.set('Escribe los nombres y los dos apellidos del representante.'); return; }
    if (!this.ced(r.cedula)) { this.rErr.set('Revisa la cédula del representante.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email.trim())) { this.rErr.set('Revisa el correo del representante: no es válido.'); return; }
    if (!PHONE.test(r.phone)) { this.rErr.set('El celular debe empezar con 0 y tener 9 o 10 dígitos.'); return; }
    const names = { firstNames: toTitleCase(r.firstNames.trim()), lastNames: toTitleCase(r.lastNames.trim()) };
    if (!(await this.confirmFinal('los datos del representante'))) return;
    this.busy.set(true);
    try {
      const current = this.primary();
      if (current && !this.replacing()) {
        const x = await this.api.updateRep(current.linkId, { ...names, email: r.email.trim(), phone: r.phone });
        this.reps.set(x.representatives);
        this.locks.set(x.locks);
        if (x.note) this.rNote.set(x.note);
        else this.toast.ok('Representante actualizado');
      } else {
        // Primero se quita al anterior (la ventana de edición sigue abierta) y luego se registra al nuevo, que la cierra.
        if (current) await this.api.removeRep(current.linkId);
        const x = await this.api.addRep({ ...names, cedula: r.cedula, email: r.email.trim(), phone: r.phone, isPrimary: true });
        this.reps.set(x.representatives);
        this.locks.set(x.locks);
        this.session.markProfileCompleted(x.completed);
        this.replacing.set(false);
        this.toast.ok('Representante guardado');
      }
      this.fillRep(this.primary());
      this.session.markProfileCompleted(this.hasPrimary());
    } catch (e) { this.rErr.set(apiMessage(e, 'No pudimos guardar al representante.')); }
    finally { this.busy.set(false); }
  }

  /** Aviso antes de guardar: después no se podrá corregir sin el Departamento de Sistemas. */
  private async confirmFinal(what: string): Promise<boolean> {
    const extra = what === 'los datos del representante' && this.replacing() && this.primary()
      ? ` ${this.primary()!.names} dejará de aparecer en tus nuevas solicitudes; las ya enviadas no cambian.` : '';
    const ok = await this.confirm.ask({ title: `Revisa ${what}`, confirmLabel: 'Sí, guardar', tone: 'primary',
      risk: `Después de guardar no podrás cambiarlos desde tu cuenta. Si luego necesitas corregirlos, tendrás que acercarte al Departamento de Sistemas.${extra}` });
    return ok !== null;
  }

  go() { void this.router.navigate(['/solicitud']); }
}
