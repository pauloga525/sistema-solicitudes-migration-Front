import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { InactivityService } from '../../core/auth/inactivity.service';
import { SessionService } from '../../core/auth/session.service';

export interface NavGroup { label: string | null; items: { to: string; label: string; icon: string; exact?: boolean; badge?: number }[]; }

/**
 * Marco común de los paneles de trabajo (DOCENTE, ADMIN y SUPERADMIN): riel lateral azul marino que en móvil
 * se vuelve cajón, aviso de mantenimiento y cierre de sesión por 5 minutos de inactividad.
 */
@Component({
  selector: 'app-panel-frame',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#panel-main">Saltar al contenido</a>
    <div class="shell" [class.open]="menuOpen()">
      <aside class="rail" id="panel-rail" [attr.aria-label]="subtitle()">
        <a [routerLink]="home()" class="brand">
          <img src="img/escudo-uets.png" alt="" width="34" height="34" />
          <span><strong>UETS</strong><small>{{ subtitle() }}</small></span>
        </a>
        <nav>
          @for (g of groups(); track $index) {
            @if (g.label) { <p class="grp">{{ g.label }}</p> }
            @for (l of g.items; track l.to) {
              <a [routerLink]="l.to" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!l.exact }" ariaCurrentWhenActive="page">
                <span class="material-symbols-outlined" aria-hidden="true">{{ l.icon }}</span>{{ l.label }}
                @if (l.badge) { <span class="nbadge tnum" [attr.aria-label]="l.badge + ' sin leer'">{{ l.badge > 99 ? '99+' : l.badge }}</span> }
              </a>
            }
          }
        </nav>
        <div class="me">
          <span class="av" aria-hidden="true">{{ initial() }}</span>
          <span class="who"><strong>{{ session.displayName() }}</strong><small>{{ roleLabel() }}</small></span>
          <a routerLink="/cambiar-contrasena" class="out first" aria-label="Cambiar contraseña" title="Cambiar contraseña"><span class="material-symbols-outlined">key</span></a>
          <button type="button" class="out" (click)="session.logout()" aria-label="Cerrar sesión" title="Cerrar sesión">
            <span class="material-symbols-outlined">logout</span>
          </button>
        </div>
      </aside>
      <button type="button" class="scrim" aria-label="Cerrar menú" tabindex="-1" (click)="menuOpen.set(false)"></button>
      <div class="main-col">
        <header class="mbar">
          <button type="button" class="icon-btn" (click)="menuOpen.set(true)" aria-controls="panel-rail" [attr.aria-expanded]="menuOpen()" aria-label="Abrir menú">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <img src="img/escudo-uets.png" alt="" width="28" height="28" /><strong>{{ subtitle() }}</strong>
        </header>
        @if (session.maintenance().enabled) {
          <p class="mbanner" role="status"><span class="material-symbols-outlined" aria-hidden="true">construction</span>
            Modo mantenimiento activo: los estudiantes no pueden ingresar.
            @if (session.role() === 'SUPERADMIN') { <a routerLink="/superadmin/configuracion">Configurar</a> }</p>
        }
        <main id="panel-main" class="content" tabindex="-1"><ng-content /></main>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .skip { position: absolute; left: 8px; top: -60px; z-index: 100; padding: 8px 12px; background: var(--secondary-container); color: var(--on-secondary-container); border-radius: 8px; }
    .skip:focus { top: 8px; }
    .shell { display: grid; grid-template-columns: var(--rail-w) minmax(0, 1fr); min-height: 100dvh; background: var(--background); }
    .rail { position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; background: var(--rail); color: var(--rail-ink); overflow-y: auto; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 18px 18px 14px; text-decoration: none; color: var(--rail-ink-strong); }
    .brand span { display: grid; line-height: 1.15; }
    .brand strong { font: 800 1rem/1.1 var(--font-sans); letter-spacing: 0.04em; }
    .brand small { font: var(--label-sm); color: var(--rail-ink); font-weight: 500; }
    nav { display: grid; gap: 1px; padding: 6px 10px 16px; flex: 1; align-content: start; }
    .grp { margin: 16px 10px 6px; font: var(--label-sm); text-transform: uppercase; letter-spacing: 0.08em; color: #8fa6c8; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 8px; color: var(--rail-ink); text-decoration: none;
      font: var(--label-lg); font-weight: 500; transition: background var(--dur-fast), color var(--dur-fast); }
    nav a .material-symbols-outlined { font-size: 20px; color: #8fa6c8; transition: color var(--dur-fast); }
    nav a:hover { background: var(--rail-hover); color: #fff; }
    nav a.active { background: rgb(252 204 56 / 14%); color: #fff; font-weight: 600; }
    nav a.active .material-symbols-outlined { color: var(--secondary-container); font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
    nav a:focus-visible { box-shadow: 0 0 0 2px var(--secondary-container); }
    .nbadge { margin-left: auto; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 10px; display: grid; place-items: center;
      background: var(--secondary-container); color: var(--on-secondary-container); font: 700 0.6875rem/1 var(--font-sans); }
    .me { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-top: 1px solid rgb(255 255 255 / 10%); }
    .av { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; background: var(--secondary-container); color: var(--on-secondary-container); font-weight: 700; flex: none; }
    .who { display: grid; min-width: 0; line-height: 1.2; }
    .who strong { color: #fff; font: var(--label-md); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who small { font: var(--label-sm); font-weight: 500; color: #8fa6c8; }
    .out.first { margin-left: auto; }
    .out { text-decoration: none; border: 0; background: none; color: var(--rail-ink); width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center; cursor: pointer; }
    .out:focus-visible, .mbar .icon-btn:focus-visible, nav a:focus-visible, .brand:focus-visible { outline: 2px solid var(--secondary-container); outline-offset: 1px; box-shadow: none; }
    .out:hover { background: var(--rail-hover); color: #fff; }
    .main-col { min-width: 0; display: flex; flex-direction: column; }
    .content { width: 100%; max-width: 1440px; padding: 24px 28px 40px; display: flex; flex-direction: column; gap: 18px; outline: none; }
    .mbar { display: none; }
    .scrim { display: none; }
    .mbanner { display: flex; align-items: center; gap: 8px; padding: 8px 28px; background: var(--warning-container); color: #4a2c00; font: var(--label-md); }
    .mbanner a { color: inherit; font-weight: 650; }
    @media (max-width: 980px) {
      .shell { grid-template-columns: 1fr; }
      .rail { position: fixed; inset: 0 auto 0 0; width: min(300px, 86vw); z-index: 60; transform: translateX(-102%); transition: transform var(--dur-med) var(--ease-out); }
      .open .rail { transform: none; box-shadow: var(--elev-3); }
      .open .scrim { display: block; position: fixed; inset: 0; z-index: 50; border: 0; background: var(--scrim); }
      .mbar { display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 40; padding: 8px 12px; background: var(--rail); color: #fff; }
      .mbar .icon-btn { color: #fff; }
      .content { padding: 16px; }
      .mbanner { padding-inline: 16px; }
    }
  `,
})
export class PanelFrame {
  readonly session = inject(SessionService);
  readonly groups = input.required<NavGroup[]>();
  readonly subtitle = input.required<string>();
  readonly home = input.required<string>();
  readonly menuOpen = signal(false);
  readonly initial = computed(() => (this.session.displayName()[0] ?? 'U').toUpperCase());
  readonly roleLabel = computed(() => ({ SUPERADMIN: 'Super Administrador', TEACHER: 'Docente' } as Record<string, string>)[this.session.role() ?? ''] ?? 'Administrador');

  constructor() {
    const inactivity = inject(InactivityService);
    inactivity.start();
    inject(DestroyRef).onDestroy(() => inactivity.stop());
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.menuOpen.set(false));
  }
}
