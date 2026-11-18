import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SubmissionWindow } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiMessage } from '../../../core/utils/errors';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { AdminLayout } from '../shell/admin-layout';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-12-01T08:00" (hora de Ecuador) → "1 de diciembre de 2026, 08:00". */
export function fmtLocal(v: string | null): string {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${+m[3]} de ${MONTHS[+m[2] - 1]} de ${m[1]}, ${m[4]}:${m[5]}` : '—';
}

const STATE: Record<SubmissionWindow['state'], { label: string; tag: string; text: string }> = {
  abierto: { label: 'Abierto', tag: 'ok', text: 'Los estudiantes pueden enviar solicitudes ahora.' },
  proximo: { label: 'Aún no abre', tag: 'warn', text: 'El envío se habilitará automáticamente en la fecha de inicio.' },
  cerrado: { label: 'Cerrado', tag: 'bad', text: 'La fecha de cierre ya pasó: el sistema no acepta más solicitudes.' },
  sin_fechas: { label: 'Sin fechas', tag: 'info', text: 'No hay un rango definido: el envío no tiene restricción de fechas.' },
};

/** Activación del sistema: desde y hasta cuándo los estudiantes pueden enviar solicitudes. */
@Component({
  selector: 'app-activacion-page',
  imports: [AdminLayout, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-layout title="Activación del sistema"
                      lede="Define desde qué fecha y hasta qué fecha los estudiantes pueden enviar solicitudes. Al pasar la fecha de cierre, el sistema deja de aceptarlas.">
      <div class="narrow">
        @if (loading()) {
          <div class="skeleton" style="height: 220px; border-radius: 16px" role="status" aria-label="Cargando"></div>
        } @else {
          @if (w(); as x) {
            <section class="section status" aria-live="polite">
              <header>
                <span class="material-symbols-outlined hicon" aria-hidden="true">event_available</span>
                <h2>Estado actual</h2>
                <span class="end"><span class="tag" [class]="'tag ' + st().tag">{{ st().label }}</span></span>
              </header>
              <div class="body">
                <p class="state-text">{{ st().text }}</p>
                @if (x.configured) {
                  <dl class="kv">
                    <dt>Desde</dt><dd>{{ fmt(x.start) }}</dd>
                    <dt>Hasta</dt><dd>{{ fmt(x.end) }}</dd>
                  </dl>
                }
              </div>
            </section>
          }

          <section class="section">
            <header><span class="material-symbols-outlined hicon" aria-hidden="true">edit_calendar</span><h2>Fechas de envío</h2></header>
            <form class="body form" (submit)="$event.preventDefault(); save()">
              <div class="pair">
                <div class="field"><label class="field-label" for="w-start">Desde</label>
                  <input id="w-start" class="input" type="datetime-local" name="start" [(ngModel)]="start" required /></div>
                <div class="field"><label class="field-label" for="w-end">Hasta</label>
                  <input id="w-end" class="input" type="datetime-local" name="end" [(ngModel)]="end" [min]="start" required /></div>
              </div>
              <p class="field-hint">Hora de Ecuador. El envío queda habilitado desde el primer minuto de "Desde" hasta el último de "Hasta".</p>
              @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }
              <div class="actions">
                @if (w()?.configured) {
                  <button type="button" class="btn btn-text" (click)="clear()" [disabled]="busy()">Quitar fechas</button>
                }
                <button type="submit" class="btn btn-primary" [disabled]="busy() || !start || !end">
                  @if (busy()) { <span class="material-symbols-outlined spin" aria-hidden="true">progress_activity</span> }Guardar fechas</button>
              </div>
            </form>
          </section>

          <p class="note"><span class="material-symbols-outlined" aria-hidden="true">info</span>
            <span>Además de estas fechas, el estudiante necesita un aporte activo en el <a routerLink="/admin/plazos">Calendario académico</a>
              (con él se calcula su cupo de materias) y que su curso esté activo en <a routerLink="/admin/editor">Cursos y materias</a>.</span></p>
        }
      </div>
    </app-admin-layout>
  `,
  styles: `
    .narrow { width: 100%; max-width: 760px; display: grid; gap: 16px; }
    .hicon { color: var(--on-surface-variant); font-size: 20px; }
    .state-text { margin: 0 0 12px; }
    .status .body > :last-child { margin-bottom: 0; }
    .form { display: grid; gap: 12px; }
    .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .pair .input { width: 100%; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .note { display: flex; gap: 8px; align-items: flex-start; margin: 0; color: var(--on-surface-variant); font: var(--body-md); }
    .note .material-symbols-outlined { font-size: 18px; margin-top: 2px; }
    .note a { color: var(--primary-container); font-weight: 600; }
  `,
})
export class ActivacionPage {
  private readonly api = inject(AdminApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly w = signal<SubmissionWindow | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly st = computed(() => STATE[this.w()?.state ?? 'sin_fechas']);
  readonly fmt = fmtLocal;
  start = '';
  end = '';

  constructor() {
    this.api.getSubmissionWindow().then((x) => this.apply(x), (e) => this.error.set(apiMessage(e, 'No se pudo cargar.')))
      .finally(() => this.loading.set(false));
  }

  private apply(x: SubmissionWindow) {
    this.w.set(x);
    this.start = x.start ?? '';
    this.end = x.end ?? '';
  }

  async save() {
    this.error.set(null);
    if (this.start >= this.end) { this.error.set('La fecha "Hasta" debe ser posterior a "Desde".'); return; }
    this.busy.set(true);
    try {
      this.apply(await this.api.setSubmissionWindow(this.start, this.end));
      this.toast.ok('Fechas guardadas');
    } catch (e) {
      this.error.set(apiMessage(e, 'No se pudieron guardar las fechas.'));
    } finally {
      this.busy.set(false);
    }
  }

  async clear() {
    const ok = await this.confirm.ask({ title: 'Quitar fechas', confirmLabel: 'Quitar fechas', tone: 'primary',
      risk: 'El envío de solicitudes deja de tener restricción de fechas (siguen aplicando el calendario académico y los cursos activos).' });
    if (ok === null) return;
    this.busy.set(true);
    try {
      this.apply(await this.api.setSubmissionWindow(null, null));
      this.toast.ok('Fechas quitadas');
    } catch (e) {
      this.error.set(apiMessage(e, 'No se pudieron quitar las fechas.'));
    } finally {
      this.busy.set(false);
    }
  }
}
