import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface EvalChip { subject: string; track: string; label: string; scheduledAt: string | null; missedCount?: number }

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cada materia de una solicitud con el seguimiento del docente (por atender, programada, evaluado, no se presentó). */
@Component({
  selector: 'app-eval-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items()?.length) {
      <ul class="ev">
        @for (e of items(); track e.subject) {
          <li><span class="s">{{ e.subject }}</span>
            <span class="key" [class]="'key t-' + e.track"><span class="sq" aria-hidden="true"></span>{{ e.label }}@if (e.track === 'programada' && e.scheduledAt) { · {{ when(e.scheduledAt) }} }@if (e.missedCount) { <small>(reprogramada)</small> }</span></li>
        }
      </ul>
    } @else { {{ (fallback() ?? []).join(', ') }} }
  `,
  styles: `
    .ev { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .ev li { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; }
    .s { color: var(--on-surface); }
    .key { font-size: 0.8125rem; white-space: nowrap; }
    .key small { font-weight: 400; color: var(--on-surface-variant); }
    .key.t-por_atender .sq { background: #c99700; }
    .key.t-programada .sq { background: #335f9d; }
    .key.t-evaluado .sq { background: #1b7a43; }
    .key.t-no_asistio .sq { background: #a3402e; }
    .key.t-no_requiere .sq { background: #8a909c; }
  `,
})
export class EvalChips {
  readonly items = input<EvalChip[] | null | undefined>(null);
  /** Lista simple de materias si no hay seguimiento (otros tipos de trámite). */
  readonly fallback = input<string[] | null | undefined>(null);
  when(v: string): string {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}, ${m[4]}:${m[5]}` : v;
  }
}
