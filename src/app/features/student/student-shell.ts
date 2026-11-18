import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';

/** Área del estudiante: barra superior simple, pensada para el celular. */
@Component({
  selector: 'app-student-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <div class="in">
        <a routerLink="/estudiante" class="brand"><img src="img/escudo-uets.png" alt="" width="36" height="36" /><span><strong>UETS</strong> Solicitudes</span></a>
        <nav aria-label="Área del estudiante">
          <a routerLink="/estudiante" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Mis solicitudes</a>
          <a routerLink="/estudiante/perfil" routerLinkActive="active">Mis datos</a>
        </nav>
        <button type="button" class="btn btn-text btn-sm out" (click)="session.logout()"><span class="material-symbols-outlined" aria-hidden="true">logout</span><span class="lbl">Salir</span></button>
      </div>
    </header>
    <main class="wrap student-main"><router-outlet /></main>
  `,
  styles: `
    .bar { position: sticky; top: 0; z-index: 30; background: var(--primary); color: #fff; }
    .in { max-width: 1040px; margin: 0 auto; display: flex; align-items: center; gap: 16px; padding: 8px 16px; min-height: 60px; }
    .brand { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font: var(--title-md); font-weight: 500; }
    .brand strong { font-weight: 800; letter-spacing: 0.03em; }
    nav { display: flex; gap: 4px; margin-left: auto; }
    nav a { color: #cfe0ff; text-decoration: none; padding: 8px 12px; border-radius: 8px; font: var(--label-lg); }
    nav a:hover { background: rgb(255 255 255 / 8%); color: #fff; }
    nav a.active { background: rgb(252 204 56 / 18%); color: #fff; box-shadow: inset 0 -2px 0 var(--secondary-container); }
    .out { --btn-fg: #cfe0ff; }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 18px; }
    @media (max-width: 640px) { .brand span { display: none; } .lbl { display: none; } nav { margin-left: 0; } }
  `,
})
export class StudentShell {
  readonly session = inject(SessionService);
}
