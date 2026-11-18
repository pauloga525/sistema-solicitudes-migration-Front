import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormFooter } from '../../../shared/components/form-footer';
import { SiteNavbar } from '../../../shared/components/site-navbar';

@Component({
  selector: 'app-not-found-page',
  imports: [SiteNavbar, FormFooter, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-navbar />
    <main class="page nf">
      <span class="code tnum">404</span>
      <h1>Esta página no existe</h1>
      <p>Revise la dirección o vuelva al inicio para empezar su trámite.</p>
      <a routerLink="/" class="btn btn-primary">Volver al inicio</a>
    </main>
    <app-form-footer />
  `,
  styleUrls: ['../public-page.scss'],
  styles: `
    .nf { display: grid; align-content: start; justify-items: center; text-align: center; gap: 12px; padding-top: 96px; }
    .code { font: var(--display-md); color: var(--secondary); }
    h1 { font: var(--headline-md); }
    p { color: var(--on-surface-variant); margin-bottom: 12px; }
  `,
})
export class NotFoundPage {}
