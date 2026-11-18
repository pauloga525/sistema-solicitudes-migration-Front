import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { COURSE_CODES, COURSE_LABELS_SHORT, ESTADO_LABELS, PARALELOS, REQUEST_STATUS, SUBJECTS_PERMITIDOS, humanize } from '../../../core/catalogs';
import { Paginated, RequestFilters, SolicitudRequest } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { getErrorMessage } from '../../../core/utils/errors';
import { exportSolicitudesToExcel } from '../../../core/utils/export-excel';
import { printBlob } from '../../../core/utils/pdf';
import { AdminLayout } from '../shell/admin-layout';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { STATUS_ORDER } from '../../../shared/ui/format';

interface Filters { status: string; course: string; paralelo: string; subject: string; search: string; }
const EMPTY_FILTERS: Filters = { status: '', course: '', paralelo: '', subject: '', search: '' };
const PAGE_SIZE = 20;
const EMPTY_RESULT: Paginated<SolicitudRequest> = { data: [], page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };
type Accion = 'ver' | 'aprobar' | 'negar' | 'imprimir';

/** Acciones por fila (getAcciones del original). */
export function getAcciones(status: string, requestType: string): Accion[] {
  if (requestType === 'proceso_mejora') return ['ver', 'imprimir'];
  if (status === 'pendiente' || status === 'en_revision') return ['ver', 'aprobar', 'negar'];
  if (status === 'aprobado') return ['ver', 'imprimir'];
  return ['ver'];
}

@Component({
  selector: 'app-solicitudes-page',
  imports: [AdminLayout, FormsModule, DatePipe, RouterLink, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitudes-page.html',
  styleUrl: './solicitudes-page.scss',
})
export class SolicitudesPage {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly courses = COURSE_CODES;
  readonly courseLabels = COURSE_LABELS_SHORT;
  readonly paralelos = PARALELOS;
  /** Malla por curso; mientras carga (o si falla) se usa el catálogo histórico. */
  private readonly curriculum = signal<{ byCourse: Record<string, string[]>; legacy: string[] } | null>(null);
  /** Materias del curso elegido (o todas) más los nombres históricos de solicitudes antiguas. */
  subjectsFor(course: string): string[] {
    const c = this.curriculum();
    if (!c) return [...SUBJECTS_PERMITIDOS];
    const current = course ? (c.byCourse[course] ?? []) : [...new Set(Object.values(c.byCourse).flat())].sort((a, b) => a.localeCompare(b, 'es'));
    return [...current, ...c.legacy];
  }
  readonly statuses = Object.values(REQUEST_STATUS);
  readonly estadoLabels = ESTADO_LABELS;
  readonly humanize = humanize;
  readonly skeletonRows = Array.from({ length: 6 });

  readonly result = signal<Paginated<SolicitudRequest>>(EMPTY_RESULT);
  /** Cifras por estado del conjunto filtrado (sin el filtro de estado) para la franja de etapas. */
  readonly counts = signal<Record<string, number> | null>(null);
  readonly stageOrder = STATUS_ORDER;
  readonly actionStage = computed(() => {
    const c = this.counts();
    return c && (c['pendiente'] ?? 0) >= (c['en_revision'] ?? 0) ? 'pendiente' : 'en_revision';
  });
  readonly hasFilters = computed(() => Object.values(this.activeFilters()).some(Boolean));
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  /** Valores de los selects (se aplican con "Aplicar"). */
  filters: Filters = { ...EMPTY_FILTERS };
  readonly activeFilters = signal<Filters>({ ...EMPTY_FILTERS });
  readonly searchInput = signal('');
  readonly exporting = signal(false);
  readonly actionLoading = signal<string | null>(null);
  readonly printLoading = signal<string | null>(null);
  readonly denyTarget = signal<string | null>(null);
  denyReason = '';
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private readonly denyDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deny');

  readonly canExport = computed(() => Boolean(this.activeFilters().course && this.activeFilters().subject));
  readonly exportTitle = computed(() =>
    !this.canExport()
      ? 'Selecciona materia y curso, y presiona Aplicar, para poder descargar'
      : this.result().total === 0
        ? 'No hay solicitudes para exportar'
        : `Exportar ${this.result().total} solicitud(es) a Excel`,
  );

  constructor() {
    this.api.getCurriculum('proceso_mejora').then((c) => this.curriculum.set(c), () => undefined);
    void this.fetch(EMPTY_FILTERS, 1);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.debounce));
  }

  async fetch(f: Filters, page = 1) {
    this.loading.set(true);
    this.error.set(null);
    void this.loadCounts(f);
    try {
      this.result.set(await this.api.getRequests({ ...f, page, pageSize: PAGE_SIZE }));
    } catch (err) {
      this.error.set(getErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private countsSeq = 0;
  private async loadCounts(f: Filters) {
    const seq = ++this.countsSeq;
    try {
      const totals = await Promise.all(STATUS_ORDER.map((st) => this.api.getRequests({ ...f, status: st, page: 1, pageSize: 1 }).then((r) => r.total)));
      if (seq === this.countsSeq) this.counts.set(Object.fromEntries(STATUS_ORDER.map((st, i) => [st, totals[i]])));
    } catch {
      if (seq === this.countsSeq) this.counts.set(null);
    }
  }

  /** Clic en una etapa: filtra por ese estado (otro clic lo quita). */
  pickStage(st: string) {
    this.filters = { ...this.filters, status: this.activeFilters().status === st ? '' : st };
    this.apply();
  }

  /** Búsqueda con debounce de 500 ms (se combina con los filtros ya aplicados). */
  onSearch(value: string) {
    this.searchInput.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      const f = { ...this.activeFilters(), search: value };
      this.activeFilters.set(f);
      void this.fetch(f, 1);
    }, 500);
  }

  apply() {
    const merged = { ...this.filters, search: this.searchInput() };
    this.activeFilters.set(merged);
    void this.fetch(merged, 1);
  }

  clear() {
    this.filters = { ...EMPTY_FILTERS };
    this.activeFilters.set({ ...EMPTY_FILTERS });
    this.searchInput.set('');
    void this.fetch(EMPTY_FILTERS, 1);
  }

  refresh() {
    void this.fetch(this.activeFilters(), this.result().page);
  }

  goPage(p: number) {
    const r = this.result();
    if (p < 1 || p > r.totalPages || p === r.page) return;
    void this.fetch(this.activeFilters(), p);
  }

  async exportExcel() {
    if (this.exporting() || this.result().total === 0 || !this.canExport()) return;
    this.exporting.set(true);
    try {
      const f: RequestFilters = this.activeFilters();
      await exportSolicitudesToExcel(await this.api.getAllMatchingRequests(f), f);
    } catch (err) {
      this.error.set(getErrorMessage(err));
    } finally {
      this.exporting.set(false);
    }
  }

  ver(id: string) {
    void this.router.navigate(['/admin/solicitudes', id]);
  }

  acciones(s: SolicitudRequest) {
    return getAcciones(s.status, s.requestType);
  }

  async aprobar(ev: Event, id: string) {
    ev.stopPropagation();
    this.actionLoading.set(id);
    this.actionError.set(null);
    try {
      await this.api.updateRequestStatus(id, REQUEST_STATUS.APROBADO);
      this.refresh();
    } catch (err) {
      this.actionError.set(getErrorMessage(err));
    } finally {
      this.actionLoading.set(null);
    }
  }

  openDeny(ev: Event, id: string) {
    ev.stopPropagation();
    this.denyReason = '';
    this.denyTarget.set(id);
    this.denyDialog().nativeElement.showModal();
  }

  closeDeny() {
    this.denyDialog().nativeElement.close();
  }

  async confirmDeny() {
    const id = this.denyTarget();
    if (!id || !this.denyReason.trim()) return;
    this.actionLoading.set(id);
    try {
      await this.api.updateRequestStatus(id, REQUEST_STATUS.RECHAZADO, this.denyReason);
      this.closeDeny();
      this.refresh();
    } catch (err) {
      this.actionError.set(getErrorMessage(err));
    } finally {
      this.actionLoading.set(null);
    }
  }

  async imprimir(ev: Event, id: string) {
    ev.stopPropagation();
    this.printLoading.set(id);
    this.actionError.set(null);
    try {
      printBlob(await this.api.getRequestPdf(id));
    } catch (err) {
      this.actionError.set(getErrorMessage(err));
    } finally {
      this.printLoading.set(null);
    }
  }
}
