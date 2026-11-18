import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { COURSE_CODES, COURSE_LABELS_LONG, PARALELOS, campusForCourse } from '../../../core/catalogs';
import { CupoInfo, ProcesoMejoraFormData } from '../../../core/models/models';
import { PublicApiService } from '../../../core/services/public-api.service';
import {
  ecuadorianDniValidator, fullNameValidator, nonEmptyArrayValidator, onlyLetters, toTitleCase, validateEcuadorianDni,
} from '../../../core/utils/validators';
import { FormFooter } from '../../../shared/components/form-footer';
import { MeApi, Rep } from '../../student/me-api.service';
import { SiteNavbar } from '../../../shared/components/site-navbar';

// Respaldo si falla /solicitud-config: todos los cursos (el servidor valida igual).
const FALLBACK_COURSES = [...COURSE_CODES];

type FieldName = 'representativeName' | 'representativeDni' | 'studentName' | 'studentDni';

@Component({
  selector: 'app-form-page',
  imports: [ReactiveFormsModule, RouterLink, SiteNavbar, FormFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-page.html',
  styleUrls: ['../public-page.scss', './form-page.scss'],
})
export class FormPage {
  private readonly api = inject(PublicApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly me = inject(MeApi);
  /** Representantes del estudiante (la identidad sale de su perfil; el servidor la vuelve a verificar). */
  readonly reps = signal<Rep[]>([]);
  readonly selectedRep = signal('');

  /** ?campus= del paso anterior (para "Volver"). */
  readonly campus = input<string | undefined>();
  readonly paralelos = PARALELOS;
  readonly courseLabels = COURSE_LABELS_LONG;

  readonly form = new FormGroup({
    representativeName: new FormControl('', { nonNullable: true, validators: [fullNameValidator] }),
    representativeDni: new FormControl('', { nonNullable: true, validators: [ecuadorianDniValidator] }),
    studentName: new FormControl('', { nonNullable: true, validators: [fullNameValidator] }),
    studentDni: new FormControl('', { nonNullable: true, validators: [ecuadorianDniValidator] }),
    course: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    paralelo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    subjects: new FormControl<string[]>([], { nonNullable: true, validators: [nonEmptyArrayValidator] }),
    termsAccepted: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  // getRawValue: la identidad está deshabilitada (viene del perfil) y valueChanges no la incluiría.
  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  /** Un campo muestra su error solo después de perder el foco (como el original). */
  readonly touched = signal<Record<FieldName, boolean>>({
    representativeName: false, representativeDni: false, studentName: false, studentDni: false,
  });

  readonly activeCourses = signal<string[]>(FALLBACK_COURSES);
  /** null mientras se consultan las materias del estudiante. */
  readonly activeSubjects = signal<string[] | null>(null);
  /** null mientras se consulta; false bloquea el formulario. */
  readonly aporteActivo = signal<boolean | null>(null);
  /** Mensaje si el administrador cerró (o aún no abrió) el envío de solicitudes. */
  readonly closedMsg = signal<string | null>(null);
  readonly cupoInfo = signal<CupoInfo | null>(null);

  readonly courseName = computed(() => { const c = this.value().course ?? ''; return this.courseLabels[c] ?? c; });
  readonly campusName = computed(() => campusForCourse(this.value().course ?? ''));
  readonly cupoExcedido = computed(() => {
    const c = this.cupoInfo();
    return Boolean(c && (this.value().subjects?.length ?? 0) > c.disponible);
  });
  readonly isFormValid = computed(() => this.status() === 'VALID' && !this.cupoExcedido());

  constructor() {
    const state = history.state as { formData?: ProcesoMejoraFormData } | null;
    if (state?.formData) this.form.setValue({ ...state.formData, termsAccepted: false });
    for (const k of ['representativeName', 'representativeDni', 'studentName', 'studentDni', 'course', 'paralelo'] as const) {
      this.form.controls[k].disable();
    }
    this.me.profile().then((x) => {
      const p = x.profile;
      if (!p) return;
      this.form.patchValue({ studentName: p.names, studentDni: p.cedula, course: p.course, paralelo: p.paralelo });
      this.reps.set(x.representatives);
      const keep = x.representatives.find((r) => r.cedula === this.form.controls.representativeDni.value);
      this.chooseRep((keep ?? x.representatives.find((r) => r.isPrimary) ?? x.representatives[0])?.linkId ?? '');
    }, () => undefined);

    this.api.getConfig('proceso_mejora').then(
      (cfg) => {
        this.activeCourses.set((cfg.courses ?? []).filter((c) => c.active === 1).map((c) => c.name));
      },
      () => { /* se usan los valores de respaldo */ },
    );
    // Solo las materias que cursa el estudiante (malla por curso y especialidad; el servidor lo vuelve a validar).
    this.me.subjects().then((x) => {
      this.activeSubjects.set(x.subjects);
      const keep = this.form.controls.subjects.value.filter((s) => x.subjects.includes(s));
      if (keep.length !== this.form.controls.subjects.value.length) this.form.controls.subjects.setValue(keep);
    }, () => this.activeSubjects.set([]));
    this.api.getSubmissionWindow().then((w) => this.closedMsg.set(w.open ? null : w.message), () => undefined);
    this.api.hasActiveAporte().then((v) => this.aporteActivo.set(v), () => this.aporteActivo.set(false));

    // Cupo disponible del alumno (informativo; el backend hace el chequeo autoritativo al enviar).
    let seq = 0;
    effect(() => {
      const { studentDni = '', course = '' } = this.value();
      const current = ++seq;
      if (!validateEcuadorianDni(studentDni) || !course || this.aporteActivo() !== true) {
        this.cupoInfo.set(null);
        return;
      }
      this.api.getCupo(studentDni, course).then(
        (c) => current === seq && this.cupoInfo.set({ limite: c.limite, consumido: c.consumido, disponible: c.disponible }),
        () => current === seq && this.cupoInfo.set(null),
      );
    });
    inject(DestroyRef).onDestroy(() => (seq = -1));
  }

  chooseRep(linkId: string) {
    const r = this.reps().find((x) => x.linkId === linkId);
    this.selectedRep.set(linkId);
    if (r) this.form.patchValue({ representativeName: r.names, representativeDni: r.cedula });
  }

  showError(field: FieldName): boolean {
    return this.touched()[field] && this.form.controls[field].invalid;
  }

  onNameInput(field: 'representativeName' | 'studentName', ev: Event) {
    const el = ev.target as HTMLInputElement;
    const clean = onlyLetters(el.value);
    if (clean !== el.value) el.value = clean;
    this.form.controls[field].setValue(clean);
  }

  onNameBlur(field: 'representativeName' | 'studentName') {
    this.touched.update((t) => ({ ...t, [field]: true }));
    const ctrl = this.form.controls[field];
    ctrl.setValue(toTitleCase(ctrl.value));
  }

  onDniInput(field: 'representativeDni' | 'studentDni', ev: Event) {
    const el = ev.target as HTMLInputElement;
    const clean = el.value.replace(/\D/g, '').slice(0, 10);
    if (clean !== el.value) el.value = clean;
    this.form.controls[field].setValue(clean);
  }

  onBlur(field: FieldName) {
    this.touched.update((t) => ({ ...t, [field]: true }));
  }

  isChecked(subject: string): boolean {
    return (this.value().subjects ?? []).includes(subject);
  }

  toggleSubject(subject: string) {
    const ctrl = this.form.controls.subjects;
    const cur = ctrl.value;
    ctrl.setValue(cur.includes(subject) ? cur.filter((s) => s !== subject) : [...cur, subject]);
  }

  resetForm() {
    // Solo se limpian las materias y la aceptación: la identidad viene del perfil.
    this.form.patchValue({ subjects: [], termsAccepted: false });
  }

  back() {
    void this.router.navigate(['/solicitud/tramites'], { queryParams: { campus: this.campus() ?? 'CC_MA' } });
  }

  goHome() {
    void this.router.navigate(['/']);
  }

  preview() {
    if (!this.isFormValid()) return;
    // Igual que el original: el historial queda "inicio → vista previa" (Atrás desde la vista previa vuelve al inicio).
    this.location.replaceState('/');
    void this.router.navigate(['/solicitud/preview'], {
      state: { formData: this.form.getRawValue(), campus: this.campusName() },
    });
  }
}
