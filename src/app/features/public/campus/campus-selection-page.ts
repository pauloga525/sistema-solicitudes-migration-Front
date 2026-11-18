import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SiteNavbar } from '../../../shared/components/site-navbar';

type CampusGroup = 'CC_MA' | 'YANUNCAY';

const OPTIONS: { id: CampusGroup; label: string; description: string; icon: string; img: string }[] = [
  { id: 'CC_MA', label: 'Campus Carlos Crespi / Maria Auxiliadora', icon: 'school', img: 'img/carlos.webp',
    description: 'Sede administrativa principal enfocada en Ciencias Sociales y Humanidades.' },
  { id: 'YANUNCAY', label: 'Campus Yanuncay', icon: 'science', img: 'img/yanu1.webp',
    description: 'Centro de excelencia tecnológica y laboratorios de investigación avanzada.' },
];

@Component({
  selector: 'app-campus-selection-page',
  imports: [SiteNavbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-navbar />
    <main class="page">
      <button type="button" class="back" (click)="router.navigate(['/'])">
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Volver al inicio
      </button>
      <header class="head">
        <h1>Selección de Campus</h1>
        <p>Por favor, seleccione el campus institucional correspondiente para continuar con su trámite.</p>
      </header>

      <div class="options" role="radiogroup" aria-label="Campus">
        @for (c of options; track c.id) {
          <button type="button" role="radio" class="option" [class.selected]="selected() === c.id"
                  [attr.aria-checked]="selected() === c.id" (click)="selected.set(c.id)">
            <span class="photo"><img [src]="c.img" alt="" width="640" height="360" loading="lazy" /></span>
            <span class="body">
              <span class="icon"><span class="material-symbols-outlined" aria-hidden="true">{{ c.icon }}</span></span>
              <span class="label">{{ c.label }}</span>
              <span class="desc">{{ c.description }}</span>
            </span>
            <span class="tick material-symbols-outlined filled" aria-hidden="true">check_circle</span>
          </button>
        }
      </div>

      <div class="actions-end">
        <button type="button" class="btn btn-primary" [disabled]="!selected()" (click)="continuar()">
          Continuar <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </button>
      </div>
    </main>
  `,
  styleUrls: ['../public-page.scss'],
  styles: `
    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 640px) { .options { grid-template-columns: 1fr; } }
    .option { position: relative; text-align: left; padding: 0; overflow: hidden; cursor: pointer; border-radius: var(--radius-lg);
      background: var(--surface-container-lowest); border: 2px solid var(--outline-variant); color: inherit;
      transition: border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), transform var(--dur-fast); }
    .option:hover { border-color: var(--outline); box-shadow: var(--elev-1); }
    .option:active { transform: scale(0.995); }
    .option.selected { border-color: var(--primary-container); box-shadow: var(--elev-2); }
    .photo { display: block; aspect-ratio: 16 / 7; overflow: hidden; background: var(--surface-container); }
    .photo img { width: 100%; height: 100%; object-fit: cover; filter: saturate(0.85); transition: filter var(--dur-med), transform 600ms var(--ease-out); }
    .option.selected .photo img, .option:hover .photo img { filter: none; transform: scale(1.02); }
    .body { display: grid; gap: 8px; padding: 0 22px 22px; }
    .icon { position: relative; width: 48px; height: 48px; margin-top: -24px; display: grid; place-items: center; border-radius: var(--radius-md);
      background: var(--surface-container-high); color: var(--on-surface-variant); border: 3px solid var(--surface-container-lowest);
      transition: background var(--dur-med), color var(--dur-med); }
    .selected .icon { background: var(--primary-container); color: #fff; }
    .label { font: var(--title-md); color: var(--on-surface); }
    .selected .label { color: var(--primary); }
    .desc { font: var(--body-md); color: var(--on-surface-variant); }
    .tick { position: absolute; top: 12px; right: 12px; color: #fff; font-size: 28px; opacity: 0; transform: scale(0.6);
      transition: opacity var(--dur-med), transform var(--dur-med) var(--ease-out); filter: drop-shadow(0 2px 4px rgb(0 0 0 / 40%)); }
    .selected .tick { opacity: 1; transform: none; }
  `,
})
export class CampusSelectionPage {
  readonly router = inject(Router);
  readonly options = OPTIONS;
  readonly selected = signal<CampusGroup | null>(null);

  continuar() {
    const s = this.selected();
    if (s) void this.router.navigate(['/solicitud/tramites'], { queryParams: { campus: s } });
  }
}
