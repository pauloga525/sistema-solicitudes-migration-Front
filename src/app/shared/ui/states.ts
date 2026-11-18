import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Estado vacío con explicación y acción opcional (proyectada). */
@Component({
  selector: 'app-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="material-symbols-outlined" aria-hidden="true">{{ icon() }}</span>
      <p class="t">{{ title() }}</p>
      @if (text()) { <p class="d">{{ text() }}</p> }
      <ng-content />
    </div>
  `,
  styles: `
    .empty { display: grid; justify-items: center; gap: 6px; padding: 40px 16px; text-align: center; color: var(--on-surface-variant); }
    .material-symbols-outlined { font-size: 36px; color: var(--outline); margin-bottom: 4px; }
    .t { font: var(--title-md); color: var(--on-surface); }
    .d { font: var(--body-md); max-width: 46ch; }
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly text = input('');
}

/** Filas de esqueleto mientras carga una tabla. */
@Component({
  selector: 'app-skeleton-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sk" aria-busy="true" aria-label="Cargando">
      @for (r of rowsArr(); track $index) {
        <div class="row">@for (c of colsArr(); track $index) { <span class="skeleton" [style.width.%]="60 + (($index * 17 + r) % 35)"></span> }</div>
      }
    </div>
  `,
  styles: `
    .sk { padding: 6px 0; }
    .row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 16px; padding: 13px 16px; border-bottom: 1px solid var(--surface-container-high); }
  `,
})
export class SkeletonRows {
  readonly rows = input(6);
  readonly cols = input(5);
  rowsArr() { return Array.from({ length: this.rows() }, (_, i) => i); }
  colsArr() { return Array.from({ length: this.cols() }, (_, i) => i); }
}

/** Estado de solicitud como clave de color cuadrada + etiqueta (patrón "Horario" de PUM). */
@Component({
  selector: 'app-status-key',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="key" [class]="'key k-' + status()"><span class="sq" aria-hidden="true"></span>{{ label() }}</span>`,
})
export class StatusKey {
  readonly status = input.required<string>();
  readonly label = input.required<string>();
}
