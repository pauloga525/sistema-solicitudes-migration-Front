import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SiteNavbar } from '../../../shared/components/site-navbar';
import { MeApi } from '../../student/me-api.service';
import { PublicApiService } from '../../../core/services/public-api.service';

/** "Primer trimestre" → "Primer Trimestre" (igual que el PDF). */
function trimestreLabel(name: string): string {
  const small = new Set(['de', 'del', 'la', 'el', 'y', 'e']);
  const label = name.trim().split(/\s+/).map((w, i) => (i && small.has(w.toLowerCase())) || w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1)).join(' ');
  return /trimestre/i.test(label) ? label : `${label} Trimestre`;
}

type CampusGroup = 'CC_MA' | 'YANUNCAY';
interface Tramite { id: string; label: string; description: string; badge?: string; icon: string; }

const MEJORA: Tramite = {
  id: 'proceso_mejora', label: 'Evaluación de Mejora', badge: 'Voluntario', icon: 'assignment',
  description: 'Solicita que tu representado rinda la evaluación de mejora {trimestre} en las asignaturas que requiera.',
};
// Todos los cursos están habilitados, así que Yanuncay (8vo a 3ro de Bachillerato) también tiene la Evaluación de Mejora.
const TRAMITES_POR_CAMPUS: Record<CampusGroup, Tramite[]> = { CC_MA: [MEJORA], YANUNCAY: [MEJORA] };
const CAMPUS_LABEL: Record<CampusGroup, string> = {
  CC_MA: 'Campus Carlos Crespi / Maria Auxiliadora',
  YANUNCAY: 'Campus Yanuncay',
};

@Component({
  selector: 'app-requests-list-page',
  imports: [SiteNavbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-navbar />
    <main class="page">
      <button type="button" class="back" (click)="router.navigate(['/estudiante'])">
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>Mis solicitudes
      </button>
      <header class="head">
        <span class="context">{{ campusLabel() }}</span>
        <h1>Solicitudes Disponibles</h1>
        <p>Seleccione el tipo de solicitud que desea realizar.</p>
      </header>

      @if (closedMsg(); as msg) {
        <p class="alert alert-info closed" role="status"><span class="material-symbols-outlined" aria-hidden="true">event_busy</span>{{ msg }}</p>
      }
      @if (tramites().length === 0) {
        <section class="empty panel">
          <span class="empty-icon"><span class="material-symbols-outlined" aria-hidden="true">inbox</span></span>
          <h2>Sin solicitudes disponibles</h2>
          <p>Por el momento no hay trámites habilitados para el Campus Yanuncay. Consulte con su institución para más información.</p>
        </section>
      } @else {
        <ul class="list">
          @for (t of tramites(); track t.id) {
            <li>
              <button type="button" class="tramite" (click)="open(t)">
                <span class="ticon"><span class="material-symbols-outlined" aria-hidden="true">{{ t.icon }}</span></span>
                <span class="tbody">
                  <span class="trow"><span class="tlabel">{{ t.label }}</span>
                    @if (t.badge) { <span class="tbadge">{{ t.badge }}</span> }</span>
                  <span class="tdesc">{{ desc(t) }}</span>
                </span>
                <span class="material-symbols-outlined arrow" aria-hidden="true">arrow_forward</span>
              </button>
            </li>
          }
        </ul>
      }
    </main>

    <dialog #warn class="dialog" aria-labelledby="warn-title" (close)="pending.set(null)">
      <div class="dialog-head">
        <span class="warn-icon"><span class="material-symbols-outlined" aria-hidden="true">warning</span></span>
        <h2 id="warn-title" class="dtitle">Antes de continuar</h2>
      </div>
      <div class="dialog-body">
        <p class="dtext">Recuerde que el proceso de evaluación de <strong>MEJORA</strong> es totalmente <strong>VOLUNTARIO</strong> y está a
          disposición de todos los estudiantes. Para evitar el desperdicio de papel o la sobrecarga de actividades al estudiante, si su
          representado <strong>no requiere</strong> la evaluación de MEJORA, por favor, <strong>no llene el formulario</strong>. En caso de
          requerir la Mejora, continúe con el registro.</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-outline" (click)="warn.close()">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="accept()">Acepto, continuar</button>
      </div>
    </dialog>
  `,
  styleUrls: ['../public-page.scss'],
  styles: `
    .closed { margin-bottom: 16px; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
    .tramite { width: 100%; display: flex; align-items: center; gap: 20px; padding: 22px; text-align: left; cursor: pointer; color: inherit;
      background: var(--surface-container-lowest); border: 2px solid var(--outline-variant); border-radius: var(--radius-lg);
      transition: border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out); }
    .tramite:hover { border-color: var(--primary-container); box-shadow: var(--elev-2); }
    .ticon { width: 52px; height: 52px; flex: none; display: grid; place-items: center; border-radius: var(--radius-md);
      background: var(--primary-fixed); color: var(--primary-container); transition: background var(--dur-med), color var(--dur-med); }
    .tramite:hover .ticon { background: var(--primary-container); color: #fff; }
    .tbody { flex: 1; display: grid; gap: 4px; }
    .trow { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .tlabel { font: var(--title-md); color: var(--on-surface); }
    .tbadge { padding: 2px 10px; border-radius: var(--radius-full); background: var(--secondary-fixed); color: #4d3b00; font: var(--label-sm); }
    .tdesc { font: var(--body-md); color: var(--on-surface-variant); }
    .arrow { color: var(--outline); transition: transform var(--dur-med) var(--ease-out), color var(--dur-med); }
    .tramite:hover .arrow { color: var(--primary-container); transform: translateX(3px); }
    .empty { padding: 56px 24px; display: grid; justify-items: center; text-align: center; gap: 8px; }
    .empty-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: var(--surface-container); color: var(--outline); margin-bottom: 8px; }
    .empty h2 { font: var(--title-lg); color: var(--on-surface); }
    .empty p { color: var(--on-surface-variant); max-width: 44ch; }
    .warn-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: var(--warning-container); color: var(--warning); flex: none; }
    .dtitle { font: var(--title-lg); }
    .dtext { color: var(--on-surface-variant); font: var(--body-lg); font-size: 0.9375rem; }
    .dtext strong { color: var(--on-surface); }
  `,
})
export class RequestsListPage {
  readonly router = inject(Router);
  /** ?campus= (por defecto CC_MA, como el original). */
  readonly campus = input<string | undefined>();
  private readonly group = computed<CampusGroup>(() => (this.campus() as CampusGroup) || 'CC_MA');
  readonly tramites = computed(() => TRAMITES_POR_CAMPUS[this.group()] ?? []);
  readonly campusLabel = computed(() => CAMPUS_LABEL[this.group()]);
  readonly pending = signal<Tramite | null>(null);
  /** Trimestre del aporte activo (lo define el calendario académico). */
  readonly trimestre = signal<string | null>(null);
  /** Envío cerrado por fechas (lo define el administrador en "Activación del sistema"). */
  readonly closedMsg = signal<string | null>(null);

  constructor() {
    inject(PublicApiService).getSubmissionWindow().then((w) => this.closedMsg.set(w.open ? null : w.message), () => undefined);
    inject(MeApi).quota().then((q) => this.trimestre.set(q.aporte?.trimestre ?? null), () => undefined);
  }

  desc(t: Tramite): string {
    const tr = this.trimestre();
    return t.description.replace('{trimestre}', tr ? `del ${trimestreLabel(tr)}` : 'del trimestre en curso');
  }
  private readonly warn = viewChild.required<ElementRef<HTMLDialogElement>>('warn');

  open(t: Tramite) {
    this.pending.set(t);
    this.warn().nativeElement.showModal();
  }

  accept() {
    const t = this.pending();
    this.warn().nativeElement.close();
    if (t) void this.router.navigate(['/solicitud/formulario'], { queryParams: { campus: this.group(), tipo: t.id } });
  }
}
