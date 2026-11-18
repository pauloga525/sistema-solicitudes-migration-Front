import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-form-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="ff">
      <p class="t">UETS - Sistema de Solicitudes</p>
      <p class="c">© {{ year }} Unidad Educativa Técnico Salesiano - Departamento de Sistemas. Todos los derechos reservados.</p>
    </footer>
  `,
  styles: `
    .ff { margin-top: auto; background: var(--inverse-surface); color: var(--inverse-on-surface); padding: 24px 16px; text-align: center; display: grid; gap: 4px; }
    .t { font: var(--label-lg); }
    .c { font: var(--body-md); color: #aeb6c4; }
  `,
})
export class FormFooter {
  readonly year = 2026;
}
