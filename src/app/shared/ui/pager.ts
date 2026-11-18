import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-pager',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pager" aria-label="Paginación">
      <span class="info">{{ from() | number }}–{{ to() | number }} de {{ total() | number }}</span>
      <button type="button" class="icon-btn" (click)="go.emit(page() - 1)" [disabled]="page() <= 1" aria-label="Página anterior">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <span class="pg">Página {{ page() }} de {{ totalPages() }}</span>
      <button type="button" class="icon-btn" (click)="go.emit(page() + 1)" [disabled]="page() >= totalPages()" aria-label="Página siguiente">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </nav>
  `,
  styles: `
    .pager { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 10px 12px; font: var(--label-md); color: var(--on-surface-variant);
      font-variant-numeric: tabular-nums; border-top: 1px solid var(--outline-variant); }
    .info { margin-right: auto; }
    .pg { min-width: 110px; text-align: center; }
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly go = output<number>();
  readonly from = computed(() => (this.total() ? (this.page() - 1) * this.pageSize() + 1 : 0));
  readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}
