import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-navbar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="nav">
      <div class="container nav-inner">
        <a routerLink="/" class="brand" aria-label="Ir al inicio">
          <img src="img/escudo-uets.png" alt="Escudo UETS" width="44" height="44" />
          <span class="brand-text"><strong>UETS</strong><span class="sep" aria-hidden="true"></span>Sistema de Solicitudes</span>
        </a>
        <div class="end">
          @if (session.user(); as u) {
            <a [routerLink]="u.home" class="btn btn-text btn-sm">{{ u.role === 'STUDENT' ? 'Mis solicitudes' : 'Ir al panel' }}</a>
          } @else {
            <a routerLink="/ingresar" class="btn btn-text btn-sm">Ingresar</a>
          }
          @if (showCta()) {
            <button type="button" class="btn btn-primary btn-sm" (click)="start.emit()">Iniciar solicitud</button>
          }
          @if (session.user(); as u) {
            <span class="who" [title]="u.email || u.username || ''">{{ session.displayName() }}</span>
            <button type="button" class="btn btn-outline btn-sm out" (click)="logout()" [disabled]="leaving()">
              <span class="material-symbols-outlined" aria-hidden="true">logout</span>Cerrar sesión</button>
          }
        </div>
      </div>
    </header>
  `,
  styles: `
    .nav { position: sticky; top: 0; z-index: 40; background: rgb(255 255 255 / 92%); backdrop-filter: saturate(1.4) blur(10px);
      border-bottom: 1px solid var(--outline-variant); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 68px; }
    .brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: var(--primary); border-radius: var(--radius-full); }
    .brand img { width: 44px; height: 44px; }
    .brand-text { display: inline-flex; align-items: center; gap: 10px; font: var(--title-md); color: var(--on-surface); }
    .brand-text strong { color: var(--primary); font-weight: 800; letter-spacing: 0.02em; }
    .end { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .who { max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--label-md);
      color: var(--on-surface-variant); padding-left: 10px; margin-left: 4px; border-left: 1px solid var(--outline-variant); }
    .out .material-symbols-outlined { font-size: 18px; }
    @media (max-width: 720px) { .who { display: none; } }
    @media (max-width: 560px) { .out { padding-inline: 10px; } }
    .sep { width: 1px; height: 18px; background: var(--outline-variant); }
    @media (max-width: 480px) { .brand-text { font-size: 0.875rem; } .sep { display: none; } .brand-text { flex-direction: column; align-items: flex-start; gap: 0; line-height: 1.2; } }
  `,
})
export class SiteNavbar {
  readonly session = inject(SessionService);
  readonly showCta = input(false);
  readonly start = output<void>();
  readonly leaving = signal(false);

  /** Cerrar sesión también desde las páginas públicas (inicio, trámites, formulario). */
  async logout() {
    this.leaving.set(true);
    try { await this.session.logout(); } finally { this.leaving.set(false); }
  }
}
