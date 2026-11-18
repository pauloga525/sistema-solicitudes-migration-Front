import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { COURSE_LABELS_LONG } from '../../../core/catalogs';
import { ConfigItem, CourseSubjectGroup, SolicitudConfig } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminLayout } from '../shell/admin-layout';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const REQUEST_TYPE_LABELS: Record<string, string> = { proceso_mejora: 'Proceso de Mejora' };

@Component({
  selector: 'app-editor-detalle-page',
  imports: [AdminLayout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-layout [title]="label()" backTo="/admin/editor" backLabel="Cursos y materias"
                      lede="Cada estudiante ve solo las materias de su curso y especialidad. Activa o desactiva cursos y, dentro de cada curso, sus materias. Los cambios se guardan al instante.">
      @if (error()) {
        <div class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}
          <span class="alert-actions"><button type="button" class="icon-btn" (click)="error.set(null)" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button></span></div>
      }
      @if (loading()) {
        <div class="cols" role="status" aria-label="Cargando configuración">
          @for (i of [1, 2]; track i) { <div class="section"><div class="body"><span class="skeleton" style="height:320px;display:block"></span></div></div> }
        </div>
      } @else if (config(); as cfg) {
        <div class="cols">
          <section class="section">
            <header>
              <span class="material-symbols-outlined hicon" aria-hidden="true">school</span>
              <h2>Cursos</h2>
              <span class="end"><span class="tag" [class.ok]="activeCount(cfg.courses) > 0">{{ activeCount(cfg.courses) }} / {{ cfg.courses.length }} activos</span></span>
            </header>
            <ul class="items">
              @for (item of cfg.courses; track item.name) {
                <li class="item" [class.off]="item.active !== 1" [class.sel]="item.name === course()">
                  <button type="button" class="name pick" [id]="'courses-' + $index" (click)="pickCourse(item.name)"
                          [attr.aria-pressed]="item.name === course()">{{ courseLabels[item.name] ?? item.name }}</button>
                  <span class="status">{{ item.active === 1 ? 'Activo' : 'Inactivo' }}</span>
                  <button type="button" role="switch" class="switch" [attr.aria-checked]="item.active === 1"
                          [attr.aria-labelledby]="'courses-' + $index" [disabled]="toggling() === 'courses:' + item.name"
                          (click)="toggleCourse(item)"></button>
                </li>
              }
            </ul>
          </section>

          <section class="section">
            <header>
              <span class="material-symbols-outlined hicon" aria-hidden="true">menu_book</span>
              <h2>Materias de {{ courseLabels[course()] ?? course() }}</h2>
              @if (group(); as g) {
                <span class="end"><span class="tag" [class.ok]="activeCount(g.subjects) > 0">{{ activeCount(g.subjects) }} / {{ g.subjects.length }} activas</span></span>
              }
            </header>
            <div class="find">
              <div class="pickers">
                <div class="field"><label class="field-label" for="pick-course">Curso</label>
                  <select id="pick-course" class="select" [value]="course()" (change)="pickCourse($any($event.target).value)">
                    @for (c of cfg.courses; track c.name) { <option [value]="c.name">{{ courseLabels[c.name] ?? c.name }}</option> }
                  </select></div>
                @if (specialties().length) {
                  <div class="field"><label class="field-label" for="pick-spec">Especialidad</label>
                    <select id="pick-spec" class="select" [value]="specialty()" (change)="specialty.set($any($event.target).value)">
                      @for (s of specialties(); track s) { <option [value]="s">{{ s }}</option> }
                    </select></div>
                }
              </div>
              <label class="sr-only" for="find-subject">Buscar materia</label>
              <input id="find-subject" class="input" type="search" placeholder="Buscar materia…" autocomplete="off"
                     [value]="query()" (input)="query.set($any($event.target).value)" />
              @if (courseOff()) {
                <p class="hint">Este curso está inactivo: sus estudiantes no pueden enviar solicitudes aunque las materias estén activas.</p>
              }
            </div>
            <ul class="items" [class.dim]="courseOff()">
              @for (item of visibleSubjects(); track item.name) {
                <li class="item" [class.off]="item.active !== 1">
                  <span class="name" [id]="'subjects-' + $index">{{ item.name }}</span>
                  <span class="status">{{ item.active === 1 ? 'Activo' : 'Inactivo' }}</span>
                  <button type="button" role="switch" class="switch" [attr.aria-checked]="item.active === 1"
                          [attr.aria-labelledby]="'subjects-' + $index" [disabled]="toggling() === 'subjects:' + item.name"
                          (click)="toggleSubject(item)"></button>
                </li>
              } @empty {
                <li class="item none">{{ query() ? 'Ninguna materia coincide con la búsqueda.' : 'Este curso no tiene materias registradas.' }}</li>
              }
            </ul>
          </section>
        </div>
      }
    </app-admin-layout>
  `,
  styles: `
    .cols { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; align-items: start; }
    @media (max-width: 980px) { .cols { grid-template-columns: 1fr; } }
    .hicon { color: var(--on-surface-variant); font-size: 20px; }
    .find { display: grid; gap: 10px; padding: 12px 18px 4px; }
    .pickers { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .find .input, .find .select { width: 100%; }
    .hint { margin: 0; font-size: 0.875rem; color: var(--on-surface-variant); }
    .items { list-style: none; margin: 0; padding: 4px 0; }
    .items.dim .name { color: var(--on-surface-variant); }
    .item { display: flex; align-items: center; gap: 12px; padding: 8px 18px; min-height: 48px; }
    .item + .item { border-top: 1px solid var(--surface-container-high); }
    .item:hover { background: #f5f8fc; }
    .item.sel { background: #eef3fa; box-shadow: inset 3px 0 0 var(--primary); }
    .item.none { color: var(--on-surface-variant); }
    .name { flex: 1; color: var(--on-surface); }
    .pick { text-align: left; background: none; border: 0; padding: 6px 0; font: inherit; cursor: pointer; }
    .pick:hover { text-decoration: underline; }
    .pick:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }
    .item.off .name { color: var(--on-surface-variant); }
    .status { font: var(--label-md); color: var(--success); min-width: 56px; text-align: right; }
    .item.off .status { color: var(--on-surface-variant); }
  `,
})
export class EditorDetallePage {
  private readonly api = inject(AdminApiService);
  readonly requestType = input.required<string>();
  readonly label = computed(() => REQUEST_TYPE_LABELS[this.requestType()] ?? this.requestType());
  readonly courseLabels = COURSE_LABELS_LONG;
  readonly config = signal<SolicitudConfig | null>(null);
  readonly groups = signal<CourseSubjectGroup[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly toggling = signal<string | null>(null);

  /** Curso y especialidad cuyas materias se están viendo. */
  readonly course = signal('1ro_Basica');
  readonly specialty = signal('');
  readonly query = signal('');

  readonly specialties = computed(() =>
    this.groups().filter((g) => g.course === this.course() && g.specialty).map((g) => g.specialty as string));
  readonly group = computed(() => {
    const spec = this.specialties().length ? this.specialty() || this.specialties()[0] : null;
    return this.groups().find((g) => g.course === this.course() && (g.specialty ?? null) === spec) ?? null;
  });
  readonly visibleSubjects = computed(() => {
    const q = fold(this.query().trim());
    const items = this.group()?.subjects ?? [];
    return q ? items.filter((i) => fold(i.name).includes(q)) : items;
  });
  readonly courseOff = computed(() => this.config()?.courses.find((c) => c.name === this.course())?.active === 0);

  constructor() {
    effect(() => {
      const rt = this.requestType();
      this.loading.set(true);
      Promise.all([this.api.getConfig(rt), this.api.getCourseSubjects(rt)])
        .then(([c, g]) => { this.config.set(c); this.groups.set(g.groups); },
          () => this.error.set('No se pudo cargar la configuración.'))
        .finally(() => this.loading.set(false));
    });
  }

  activeCount(items: ConfigItem[]): number {
    return items.filter((i) => i.active === 1).length;
  }

  pickCourse(course: string) {
    this.course.set(course);
    this.specialty.set('');
    this.query.set('');
  }

  async toggleCourse(item: ConfigItem) {
    this.toggling.set(`courses:${item.name}`);
    try {
      this.config.set(await this.api.updateConfigItem(this.requestType(), 'courses', item.name, item.active ? 0 : 1));
    } catch {
      this.error.set('Error al actualizar el curso.');
    } finally {
      this.toggling.set(null);
    }
  }

  async toggleSubject(item: ConfigItem) {
    const g = this.group();
    if (!g) return;
    this.toggling.set(`subjects:${item.name}`);
    try {
      const updated = await this.api.updateCourseSubject(this.requestType(), g.key, item.name, item.active ? 0 : 1);
      this.groups.update((all) => all.map((x) => (x.key === updated.key ? updated : x)));
    } catch {
      this.error.set('Error al actualizar la materia.');
    } finally {
      this.toggling.set(null);
    }
  }
}
