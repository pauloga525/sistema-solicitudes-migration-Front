import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { REQUEST_STATUS, humanize } from '../../../core/catalogs';
import { SolicitudRequest } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { getErrorMessage } from '../../../core/utils/errors';
import { downloadBlob, printBlob } from '../../../core/utils/pdf';
import { ExpedienteView } from '../seguimiento/expediente';
import { AdminLayout } from '../shell/admin-layout';

const ESTADO_CONFIG: Record<string, { label: string }> = {
  pendiente: { label: 'Pendiente de revisión' }, aprobado: { label: 'Aprobado' }, rechazado: { label: 'Rechazado' },
  en_revision: { label: 'En revisión' }, cancelado: { label: 'Cancelado' },
};

@Component({
  selector: 'app-detalle-page',
  imports: [AdminLayout, DatePipe, FormsModule, RouterLink, ExpedienteView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detalle-page.html',
  styleUrl: './detalle-page.scss',
})
export class DetallePage {
  private readonly api = inject(AdminApiService);
  readonly id = input.required<string>();
  readonly humanize = humanize;

  readonly solicitud = signal<SolicitudRequest | null>(null);
  readonly history = signal<{ id: string; eventLabel: string; fromStatus: string | null; toStatus: string | null; actorName: string | null; actorRoleLabel: string | null; comment: string | null; createdAt: string }[]>([]);
  estadoLabel(s: string) { return ESTADO_CONFIG[s]?.label ?? s; }
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly pdfLoading = signal(false);
  readonly printLoading = signal(false);
  denyReason = '';
  readonly denyOpen = signal(false);
  readonly version = signal(0);
  private readonly route = inject(ActivatedRoute);
  private scrolled = false;
  /** Desde "Seguimiento de evaluaciones" se llega con #seguimiento: baja al expediente cuando termina de cargar. */
  onExpLoaded() {
    if (this.scrolled || this.route.snapshot.fragment !== 'seguimiento') return;
    this.scrolled = true;
    setTimeout(() => document.getElementById('seguimiento')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  private readonly denyDialog = viewChild<ElementRef<HTMLDialogElement>>('deny');

  readonly status = computed(() => this.solicitud()?.status ?? 'pendiente');
  readonly estado = computed(() => ESTADO_CONFIG[this.status()] ?? ESTADO_CONFIG['pendiente']);
  readonly isProcesoMejora = computed(() => this.solicitud()?.requestType === 'proceso_mejora');
  readonly isPending = computed(() => this.status() === 'pendiente' || this.status() === 'en_revision');
  readonly title = computed(() => this.solicitud()?.requestNumber ?? `Solicitud #${this.id().slice(-6)}`);

  constructor() {
    effect(() => {
      const id = this.id();
      this.loading.set(true);
      this.error.set(null);
      // GET /requests/:id — solo lectura: abrir el detalle ya no aprueba la solicitud (se aprueba o se niega a mano).
      this.api.getRequestById(id).then(
        (s) => { this.solicitud.set(s); this.loadHistory(); },
        (err) => this.error.set(getErrorMessage(err)),
      ).finally(() => this.loading.set(false));
    });
  }

  private loadHistory() {
    this.api.getRequestHistory(this.id()).then((h) => this.history.set(h), () => this.history.set([]));
  }

  private async changeStatus(status: string, reason?: string): Promise<boolean> {
    this.actionLoading.set(true);
    this.actionError.set(null);
    try {
      this.solicitud.set(await this.api.updateRequestStatus(this.id(), status, reason));
      this.loadHistory();
      this.version.update((v) => v + 1);
      return true;
    } catch (err) {
      this.actionError.set(getErrorMessage(err));
      return false;
    } finally {
      this.actionLoading.set(false);
    }
  }

  approve() {
    void this.changeStatus(REQUEST_STATUS.APROBADO);
  }

  openDeny() {
    this.denyReason = '';
    this.actionError.set(null);
    this.denyOpen.set(true);
    this.denyDialog()?.nativeElement.showModal();
  }

  closeDeny() {
    this.denyDialog()?.nativeElement.close();
  }

  async confirmDeny() {
    if (!this.denyReason.trim()) {
      this.actionError.set('Debe indicar el motivo del rechazo.');
      return;
    }
    await this.changeStatus(REQUEST_STATUS.RECHAZADO, this.denyReason.trim());
    this.closeDeny();
    this.denyReason = '';
  }

  async download() {
    this.pdfLoading.set(true);
    try {
      downloadBlob(await this.api.getRequestPdf(this.id()), `solicitud-${this.solicitud()?.requestNumber ?? this.id()}.pdf`);
    } catch (err) {
      this.actionError.set(getErrorMessage(err));
    } finally {
      this.pdfLoading.set(false);
    }
  }

  async print() {
    this.printLoading.set(true);
    try {
      printBlob(await this.api.getRequestPdf(this.id()));
    } catch (err) {
      this.actionError.set(getErrorMessage(err));
    } finally {
      this.printLoading.set(false);
    }
  }
}
