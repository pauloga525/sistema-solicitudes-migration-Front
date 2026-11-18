import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminLayout } from '../shell/admin-layout';

const TYPES = [
  { id: 'proceso_mejora', label: 'Proceso de Mejora', icon: 'edit_note',
    description: 'Gestiona los cursos y materias habilitados para la evaluación de mejora.' },
];

@Component({
  selector: 'app-editor-page',
  imports: [AdminLayout, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-layout title="Cursos y materias" lede="Elige el trámite para decidir qué cursos y materias puede solicitar el estudiante.">
      <div class="table-wrap">
        <ul class="types">
          @for (t of types; track t.id) {
            <li>
              <a class="type" [routerLink]="['/admin/editor', t.id]">
                <span class="ticon"><span class="material-symbols-outlined" aria-hidden="true">{{ t.icon }}</span></span>
                <span class="tbody"><span class="tlabel">{{ t.label }}</span><span class="tdesc">{{ t.description }}</span></span>
                <span class="material-symbols-outlined arrow" aria-hidden="true">chevron_right</span>
              </a>
            </li>
          }
        </ul>
      </div>
    </app-admin-layout>
  `,
  styles: `
    .types { list-style: none; margin: 0; padding: 0; }
    .type { display: flex; align-items: center; gap: 16px; padding: 16px 18px; text-decoration: none; color: inherit; transition: background var(--dur-fast); }
    .type:hover { background: #f5f8fc; }
    .ticon { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--primary-fixed); color: var(--primary); }
    .tbody { flex: 1; display: grid; gap: 2px; }
    .tlabel { font: var(--title-md); color: var(--on-surface); }
    .tdesc { color: var(--on-surface-variant); }
    .arrow { color: var(--outline); }
  `,
})
export class EditorPage {
  readonly types = TYPES;
}
