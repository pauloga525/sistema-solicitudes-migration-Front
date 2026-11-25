import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COURSE_LABELS_LONG, COURSE_LABELS_SHORT } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { STATUS_LABELS, fmtAgo, fmtDateTime } from '../../../shared/ui/format';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { TeacherApi } from '../teacher-api';
import { CLOSED_REQUEST, TRACK_LABELS, TRACK_ORDER, TeacherItem, TeacherSubject, TrackStatus } from '../teacher.models';
import { fmtSchedule } from './teacher-format';

/** Solicitudes de las materias del docente, con su seguimiento (por atender → programada → evaluado). */
@Component({
  selector: 'app-teacher-requests',
  imports: [FormsModule, RouterLink, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Solicitudes</h1>
      <p class="lede">Estudiantes que pidieron rendir la evaluación de mejora en tus materias. El estado de la solicitud lo maneja la administración; tú marcas tu seguimiento.</p></div></div>

    <div class="stages tri" role="group" aria-label="Filtrar por seguimiento">
      @for (st of order; track st) {
        <button type="button" class="stage" [class.now]="st === 'por_atender' && counts()[st] > 0" [class.sel]="track() === st"
                [attr.aria-pressed]="track() === st" (click)="setTrack(track() === st ? '' : st)">
          <span class="n">{{ counts()[st] }}</span>
          <span class="key" [class]="'key t-' + st"><span class="sq" aria-hidden="true"></span>{{ labels[st] }}</span>
          <span class="cap">{{ track() === st ? 'Filtrando · quitar' : st === 'por_atender' && counts()[st] > 0 ? 'Requiere tu acción' : ' ' }}</span>
        </button>
      }
    </div>

    <section class="filters" aria-label="Filtros">
      <div class="field grow"><label class="field-label" for="t-subj">Materia y curso</label>
        <select id="t-subj" class="select" [ngModel]="subjectKey()" (ngModelChange)="setSubject($event)">
          <option value="">Todas mis materias</option>
          @for (s of subjects(); track s.key) { <option [value]="s.key">{{ s.subject }} · {{ short(s.course) }} {{ s.paralelo }}</option> }
        </select></div>
      <div class="field grow"><label class="field-label" for="t-q">Estudiante</label>
        <input id="t-q" class="input" type="search" placeholder="Nombre o número de solicitud" [ngModel]="search()" (ngModelChange)="search.set($event)" /></div>
      @if (track() || subjectKey() || search()) {
        <div class="factions"><button type="button" class="btn btn-text btn-sm" (click)="clearAll()">Limpiar filtros</button></div>
      }
    </section>

    @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }

    @if (selected().size) {
      <div class="bulk" role="region" aria-label="Acciones para las seleccionadas">
        <strong class="tnum">{{ selected().size }} {{ selected().size === 1 ? 'seleccionada' : 'seleccionadas' }}</strong>
        <button type="button" class="btn btn-outline btn-sm" (click)="openUpdate([...selected()], 'programada')">
          <span class="material-symbols-outlined" aria-hidden="true">event</span>Programar evaluación…</button>
        <button type="button" class="btn btn-text btn-sm end" (click)="clearSelection()">Quitar selección</button>
      </div>
    }

    @if (rows(); as list) {
      @if (list.length) {
        <section class="section">
          <table class="dtable">
            <caption class="sr-only">Solicitudes de evaluación de mejora en tus materias</caption>
            <thead><tr>
              <th class="ck"><input type="checkbox" class="cbox" aria-label="Seleccionar todas las que se pueden actualizar"
                [checked]="allChecked()" [indeterminate]="someChecked()" (change)="toggleAll()" [disabled]="!selectable().length" /></th>
              <th>Estudiante</th><th>Curso</th><th>Materia</th><th>Enviada</th><th>Solicitud</th><th>Tu seguimiento</th>
              <th><span class="sr-only">Acciones</span></th>
            </tr></thead>
            <tbody>
              @for (r of list; track r.id) {
                <tr class="clickable" [class.closed]="closed(r)" [class.fresh]="r.isNew" (click)="openItem(r.id)">
                  <td class="ck" (click)="$event.stopPropagation()">
                    @if (!closed(r) && !final(r)) { <input type="checkbox" class="cbox" [checked]="selected().has(r.id)" (change)="toggle(r.id)" [attr.aria-label]="'Seleccionar ' + r.studentName" /> }
                  </td>
                  <td><a class="strong rowlink" [routerLink]="['/docente/solicitudes', r.id]" (click)="$event.stopPropagation()">{{ r.studentName }}</a>@if (r.isNew) { <span class="tag gold newtag">Nueva</span> }
                    <span class="sub tnum">{{ r.requestNumber }}</span></td>
                  <td class="opt nowrap">{{ short(r.course) }} {{ r.paralelo }}</td>
                  <td class="opt">{{ r.subject }}</td>
                  <td class="opt nowrap" [title]="dt(r.submittedAt)">{{ ago(r.submittedAt) }}</td>
                  <td class="opt"><span class="mlabel">Solicitud: </span><span class="key" [class]="'key k-' + r.requestStatus"><span class="sq" aria-hidden="true"></span>{{ status[r.requestStatus] ?? r.requestStatus }}</span></td>
                  <td class="opt"><span class="mlabel">Tu seguimiento: </span>
                    @if (closed(r)) { <span class="key t-cerrada"><span class="sq" aria-hidden="true"></span>No requiere evaluación</span> }
                    @else {
                      <span class="key" [class]="'key t-' + r.track"><span class="sq" aria-hidden="true"></span>{{ labels[r.track] }}</span>
                      @if (r.track === 'programada' && r.scheduledAt) { <span class="sub tnum">{{ schedule(r.scheduledAt) }}</span> }
                    }
                  </td>
                  <td class="act"><span class="material-symbols-outlined chev" aria-hidden="true">chevron_right</span></td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        <p class="count muted tnum">{{ list.length }} {{ list.length === 1 ? 'solicitud' : 'solicitudes' }}</p>
      } @else {
        <div class="section"><app-empty icon="assignment"
          [title]="track() || subjectKey() || search() ? 'No hay solicitudes con esos filtros' : 'Aún no hay solicitudes en tus materias'"
          [text]="track() || subjectKey() || search() ? 'Cambia o limpia los filtros.' : 'Cuando un estudiante solicite la evaluación de mejora en una de tus materias, aparecerá aquí y te llegará una notificación.'" /></div>
      }
    } @else if (!error()) { <app-skeleton-rows [rows]="6" [cols]="5" /> }

    <dialog #dlg class="dialog upd" aria-labelledby="upd-title" (close)="editing.set(null)">
      @if (editing(); as e) {
        <form method="dialog" (submit)="$event.preventDefault(); save()">
          <div class="dialog-head"><h2 id="upd-title" class="dtitle">
            {{ e.ids.length === 1 ? 'Seguimiento de ' + (one()?.studentName ?? '') : 'Actualizar ' + e.ids.length + ' solicitudes' }}</h2></div>
          <div class="dialog-body">
            @if (one(); as o) { <p class="ctx">{{ o.subject }} · {{ long(o.course) }} {{ o.paralelo }} · {{ o.requestNumber }}</p> }
            <fieldset class="opts"><legend class="field-label">Estado de tu seguimiento</legend>
              @for (st of bulkOrder; track st) {
                <label class="opt-row" [class.on]="e.track === st">
                  <input type="radio" name="track" [value]="st" [ngModel]="e.track" (ngModelChange)="patch({ track: $event })" />
                  <span class="key" [class]="'key t-' + st"><span class="sq" aria-hidden="true"></span>{{ labels[st] }}</span>
                  <small>{{ help[st] }}</small>
                </label>
              }
            </fieldset>
            @if (e.track === 'programada') {
              <div class="field"><label class="field-label" for="upd-when">Fecha y hora de la evaluación</label>
                <input id="upd-when" class="input" type="datetime-local" name="when" [ngModel]="e.scheduledAt" (ngModelChange)="patch({ scheduledAt: $event })" />
                @if (e.scheduledAt) {
                  <p class="notify" role="note"><span class="material-symbols-outlined" aria-hidden="true">forward_to_inbox</span>
                    <span>Al guardar, {{ e.ids.length === 1 ? 'el estudiante recibirá' : 'cada estudiante recibirá' }} un aviso en el sistema y un correo, con copia al correo de su representante.</span></p>
                } @else {
                  <span class="field-hint">Con fecha y hora, se avisa al estudiante y a su representante.</span>
                }</div>
            }
            <div class="field"><label class="field-label" for="upd-note">Nota (opcional)</label>
              <textarea id="upd-note" class="textarea" name="note" rows="2" maxlength="300" [ngModel]="e.note" (ngModelChange)="patch({ note: $event })"
                        placeholder="Ej.: rinde junto con el paralelo B"></textarea></div>
            @if (saveError()) { <p class="alert alert-error" role="alert">{{ saveError() }}</p> }
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="dlg.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </form>
      }
    </dialog>
  `,
  styleUrl: './teacher-pages.scss',
  styles: `
    .factions { display: flex; align-items: flex-end; }
    .bulk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--radius-md);
      background: var(--primary-fixed); color: var(--on-primary-fixed); position: sticky; top: 8px; z-index: 5; }
    .bulk strong { margin-right: 6px; font: var(--label-lg); }
    .bulk .end { margin-left: auto; }
    .ck { width: 40px; }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover td { background: var(--surface-container-low); }
    .rowlink { color: inherit; text-decoration: none; }
    .rowlink:hover { text-decoration: underline; }
    .chev { color: var(--outline); font-size: 20px; vertical-align: middle; }
    .cbox { width: 18px; height: 18px; accent-color: var(--primary-container); cursor: pointer; }
    .act { text-align: right; white-space: nowrap; }
    tr.closed td { color: var(--on-surface-variant); }
    tr.closed .strong { color: var(--on-surface-variant); font-weight: 500; }
    tr.fresh td:first-child { box-shadow: inset 3px 0 0 var(--secondary-container); }
    .newtag { margin-left: 8px; vertical-align: 1px; }
    .count { margin: -6px 0 0; font: var(--label-md); }
    .upd { width: min(520px, calc(100vw - 32px)); }
    .dtitle { font: var(--title-lg); margin: 0; }
    .ctx { margin: 0; color: var(--on-surface-variant); font: var(--body-md); }
    .opts { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
    .opts legend { margin-bottom: 6px; }
    .opt-row { display: grid; grid-template-columns: auto 1fr; column-gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--outline-variant);
      border-radius: var(--radius-sm, 8px); cursor: pointer; }
    .opt-row small { grid-column: 2; color: var(--on-surface-variant); font: var(--body-md); font-size: 0.8125rem; }
    .opt-row.on { border-color: var(--primary-container); background: var(--surface-container-low); }
    .opt-row input { accent-color: var(--primary-container); width: 18px; height: 18px; }
    .field { display: grid; gap: 4px; }
    .notify { display: flex; gap: 8px; align-items: flex-start; margin: 4px 0 0; padding: 8px 10px; border-radius: 8px;
      background: var(--primary-fixed); color: var(--on-primary-fixed); font: var(--body-md); font-size: 0.8125rem; }
    .notify .material-symbols-outlined { font-size: 18px; margin-top: 1px; }
    @media (max-width: 760px) {
      .dtable tr { grid-template-columns: auto minmax(0, 1fr) auto; }
      .dtable td.ck { grid-row: span 1; }
      .dtable td.opt { grid-column: 2 / -1; }
      .act { grid-column: 3; grid-row: 1; }
      tr.fresh td:first-child { box-shadow: none; }
    }
  `,
})
export class TeacherRequestsPage {
  private readonly api = inject(TeacherApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** Filtros que llegan por la URL (desde el inicio o las notificaciones). */
  readonly trackParam = input<string | undefined>(undefined, { alias: 'track' });
  readonly materiaParam = input<string | undefined>(undefined, { alias: 'materia' });

  readonly order = TRACK_ORDER;
  readonly labels = TRACK_LABELS;
  readonly status = STATUS_LABELS;
  readonly ago = fmtAgo;
  readonly dt = fmtDateTime;
  readonly schedule = fmtSchedule;
  readonly help: Record<TrackStatus, string> = {
    por_atender: 'Aún no la organizas.',
    programada: 'Fijas fecha y hora; se avisa al estudiante y a su representante.',
    evaluado: 'El estudiante ya rindió la evaluación de mejora.',
    no_asistio: 'El estudiante no se presentó en la fecha programada. Queda registrado para la administración.',
  };

  readonly track = signal<TrackStatus | ''>('');
  readonly subjectKey = signal('');
  readonly search = signal('');
  readonly all = signal<TeacherItem[] | null>(null);
  readonly subjects = signal<TeacherSubject[]>([]);
  readonly error = signal<string | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly editing = signal<{ ids: string[]; track: TrackStatus; scheduledAt: string; note: string } | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  /** Lista con los filtros de materia y búsqueda (el seguimiento se filtra aparte para que la franja cuente bien). */
  private readonly base = computed(() => {
    const list = this.all();
    if (!list) return null;
    const q = fold(this.search().trim());
    return list.filter((r) => (!this.subjectKey() || `${r.course}|${r.paralelo}|${r.subject}` === this.subjectKey())
      && (!q || fold(`${r.studentName} ${r.requestNumber}`).includes(q)));
  });
  readonly rows = computed(() => {
    const b = this.base();
    const t = this.track();
    return b && (t ? b.filter((r) => r.track === t && !this.closed(r)) : b);
  });
  readonly counts = computed(() => {
    const b = (this.base() ?? []).filter((r) => !this.closed(r));
    return Object.fromEntries(TRACK_ORDER.map((t) => [t, b.filter((r) => r.track === t).length])) as Record<TrackStatus, number>;
  });
  /** En grupo solo se programa; el resultado (rindió / no se presentó) se registra en cada solicitud. */
  readonly bulkOrder: TrackStatus[] = ['por_atender', 'programada'];
  readonly selectable = computed(() => (this.rows() ?? []).filter((r) => !this.closed(r) && !this.final(r)).map((r) => r.id));
  readonly allChecked = computed(() => this.selectable().length > 0 && this.selectable().every((id) => this.selected().has(id)));
  readonly someChecked = computed(() => !this.allChecked() && this.selectable().some((id) => this.selected().has(id)));
  readonly one = computed(() => {
    const e = this.editing();
    return e && e.ids.length === 1 ? (this.all() ?? []).find((r) => r.id === e.ids[0]) ?? null : null;
  });

  constructor() {
    effect(() => {
      const t = this.trackParam();
      const m = this.materiaParam();
      untracked(() => {
        this.track.set(TRACK_ORDER.includes(t as TrackStatus) ? (t as TrackStatus) : '');
        this.subjectKey.set(m ?? '');
      });
    });
    void this.load();
    this.api.subjects().then((s) => this.subjects.set(s), () => undefined);
  }

  async load() {
    this.error.set(null);
    try { this.all.set(await this.api.items()); } catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar tus solicitudes.')); }
  }

  closed(r: TeacherItem): boolean { return CLOSED_REQUEST.has(r.requestStatus); }
  final(r: TeacherItem): boolean { return r.track === 'evaluado' || r.track === 'no_asistio'; }
  short(c: string): string { return COURSE_LABELS_SHORT[c] ?? c; }
  long(c: string): string { return COURSE_LABELS_LONG[c] ?? c; }
  nextTrack(t: TrackStatus): TrackStatus { return t === 'por_atender' ? 'programada' : t === 'programada' ? 'evaluado' : t; }

  setTrack(t: TrackStatus | '') { this.track.set(t); this.syncUrl(); }
  setSubject(k: string) { this.subjectKey.set(k); this.syncUrl(); }
  clearAll() { this.track.set(''); this.subjectKey.set(''); this.search.set(''); this.syncUrl(); }
  private syncUrl() {
    void this.router.navigate([], { queryParams: { track: this.track() || null, materia: this.subjectKey() || null }, replaceUrl: true });
  }

  openItem(id: string) { void this.router.navigate(['/docente/solicitudes', id]); }

  toggle(id: string) {
    this.selected.update((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  clearSelection() { this.selected.set(new Set()); }
  toggleAll() {
    this.selected.set(this.allChecked() ? new Set() : new Set(this.selectable()));
  }

  openUpdate(ids: string[], track: TrackStatus) {
    const first = (this.all() ?? []).find((r) => r.id === ids[0]);
    this.saveError.set(null);
    this.editing.set({ ids, track, scheduledAt: ids.length === 1 ? first?.scheduledAt ?? '' : '', note: ids.length === 1 ? first?.note ?? '' : '' });
    queueMicrotask(() => this.dlg().nativeElement.showModal());
  }
  patch(p: Partial<{ track: TrackStatus; scheduledAt: string; note: string }>) {
    this.editing.update((e) => (e ? { ...e, ...p } : e));
  }

  async save() {
    const e = this.editing();
    if (!e) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const updated = await this.api.updateTrack(e.ids, { track: e.track, scheduledAt: e.scheduledAt || null, note: e.note.trim() || null });
      const byId = new Map(updated.map((u) => [u.id, u]));
      this.all.update((l) => l && l.map((r) => byId.get(r.id) ?? r));
      this.selected.set(new Set());
      this.dlg().nativeElement.close();
      const told = e.track === 'programada' && e.scheduledAt
        ? (this.api.isDemo ? ' · vista previa: no se envió ningún aviso' : ' · se avisó al estudiante y a su representante') : '';
      this.toast.ok((e.ids.length === 1 ? `Seguimiento actualizado: ${TRACK_LABELS[e.track]}` : `${e.ids.length} solicitudes actualizadas`) + told);
    } catch (err) {
      this.saveError.set(apiMessage(err, 'No se pudo guardar. Inténtalo de nuevo.'));
    } finally {
      this.saving.set(false);
    }
  }
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
