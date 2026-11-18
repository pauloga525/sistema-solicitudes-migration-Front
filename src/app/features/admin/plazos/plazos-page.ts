import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AnioLectivo } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiMessage } from '../../../core/utils/errors';
import { AdminLayout } from '../shell/admin-layout';
import { AnioCard } from './anio-card';

@Component({
  selector: 'app-plazos-page',
  imports: [AdminLayout, AnioCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-layout title="Calendario académico"
                      lede="Año lectivo, trimestres y aportes. El cupo de materias de la Evaluación de Mejora se calcula con el aporte activo hoy.">
      @if (!draftNew()) {
        <button layoutActions type="button" class="btn btn-primary" (click)="nuevo()"><span class="material-symbols-outlined" aria-hidden="true">add</span>Nuevo año lectivo</button>
      }
      <div class="narrow">

        @if (error()) {
          <div class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}
            <span class="alert-actions"><button type="button" class="link" (click)="load()">Reintentar</button></span></div>
        }

        @if (loading()) {
          <div class="list" role="status" aria-label="Cargando años lectivos">
            <div class="skeleton" style="height: 58px; border-radius: 16px"></div><div class="skeleton" style="height: 58px; border-radius: 16px"></div>
          </div>
        } @else {
          <div class="list">
            @if (draftNew(); as d) { <app-anio-card [anio]="d" (saved)="savedNew($event)" (discarded)="discard($event)" /> }
            @for (a of anios(); track a._id) { <app-anio-card [anio]="a" (saved)="saved($event)" (discarded)="discard($event)" /> }
            @if (anios().length === 0 && !draftNew()) {
              <div class="empty">
                <span class="material-symbols-outlined" aria-hidden="true">event_note</span>
                <p class="empty-title">No hay años lectivos definidos todavía.</p>
                <p>Sin un aporte activo, el formulario público no acepta solicitudes. Crea el primer año lectivo para habilitarlo.</p>
              </div>
            }
          </div>
        }
      </div>
    </app-admin-layout>
  `,
  styles: `
    .narrow { width: 100%; max-width: 1040px; display: grid; gap: 16px; }
    .list { display: grid; gap: 14px; }
    .empty { display: grid; justify-items: center; gap: 6px; text-align: center; padding: 56px 16px; color: var(--on-surface-variant);
      background: var(--surface-container-lowest); border: 1px dashed var(--outline-variant); border-radius: var(--radius-lg);
      .material-symbols-outlined { font-size: 36px; color: var(--outline); } p { max-width: 52ch; } }
    .empty-title { font: var(--title-md); color: var(--on-surface); }
  `,
})
export class PlazosPage {
  private readonly api = inject(AdminApiService);
  readonly anios = signal<AnioLectivo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly draftNew = signal<AnioLectivo | null>(null);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAnios().then((a) => this.anios.set(a), (err) => this.error.set(apiMessage(err, 'No se pudieron cargar los años lectivos.')))
      .finally(() => this.loading.set(false));
  }

  nuevo() { this.draftNew.set({ name: '', startDate: '', endDate: '', trimestres: [] }); }
  savedNew(a: AnioLectivo) { this.draftNew.set(null); this.anios.update((l) => [a, ...l]); }
  saved(a: AnioLectivo) { this.anios.update((l) => l.map((x) => (x._id === a._id ? a : x))); }
  discard(id: string | null) {
    if (id === null) this.draftNew.set(null);
    else this.anios.update((l) => l.filter((x) => x._id !== id));
  }
}
