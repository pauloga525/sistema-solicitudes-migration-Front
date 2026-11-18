import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Encabezado de cada página del ADMIN (el marco con el riel lo pone AdminShell):
 * volver, título, descripción, búsqueda opcional y acciones proyectadas.
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'admin-page' },
  template: `
    @if (backTo()) {
      <a [routerLink]="backTo()" class="back"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>{{ backLabel() }}</a>
    }
    <div class="page-head">
      <div class="ttl">
        <h1>{{ title() }}</h1>
        @if (lede()) { <p class="lede">{{ lede() }}</p> }
        <ng-content select="[layoutLede]" />
      </div>
      <div class="actions">
        @if (searchable()) {
          <label class="search">
            <span class="material-symbols-outlined" aria-hidden="true">search</span>
            <span class="sr-only">Buscar solicitudes</span>
            <input type="search" placeholder="Número, estudiante, representante o cédula" [value]="searchValue()"
                   (input)="searchChange.emit($any($event.target).value)" />
            @if (searchValue()) {
              <button type="button" class="clear" (click)="searchChange.emit('')" aria-label="Limpiar búsqueda"><span class="material-symbols-outlined">close</span></button>
            }
          </label>
        }
        <ng-content select="[layoutActions]" />
      </div>
    </div>
    <ng-content />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .back { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font: var(--label-lg); width: fit-content; margin-bottom: -6px; }
    .page-head { align-items: center; }
    .ttl { min-width: 0; }
    .actions { flex-wrap: nowrap; align-items: center; }
    .search { display: flex; align-items: center; gap: 8px; width: min(380px, 100%); padding: 0 6px 0 12px; height: 40px; border-radius: 10px;
      background: var(--surface-container-lowest); border: 1px solid var(--outline-variant); color: var(--on-surface-variant);
      transition: box-shadow var(--dur-fast), border-color var(--dur-fast); }
    .search:focus-within { border-color: var(--surface-tint); box-shadow: var(--focus-ring); }
    .search input { flex: 1; min-width: 0; border: 0; background: none; outline: none; font: var(--body-md); color: var(--on-surface); }
    .search input::-webkit-search-cancel-button { display: none; }
    .clear { border: 0; background: none; color: inherit; cursor: pointer; display: grid; place-items: center; border-radius: 6px; width: 28px; height: 28px;
      .material-symbols-outlined { font-size: 18px; } }
    @media (max-width: 760px) { .actions { width: 100%; flex-wrap: wrap; } .search { width: 100%; } }
    @media (pointer: coarse) { .search input { font-size: 1rem; } }
  `,
})
export class AdminLayout {
  readonly title = input.required<string>();
  readonly lede = input('');
  readonly searchable = input(false);
  readonly backTo = input<string | null>(null);
  readonly backLabel = input('Volver');
  readonly searchValue = input('');
  readonly searchChange = output<string>();
}
