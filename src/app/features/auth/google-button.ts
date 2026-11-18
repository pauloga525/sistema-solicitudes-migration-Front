import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(cfg: Record<string, unknown>): void;
      renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
      cancel(): void;
    } } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src: GIS_SRC, async: true, defer: true });
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('gis')); };
    document.head.append(s);
  });
  return gisLoading;
}

/**
 * Botón oficial "Iniciar sesión con Google" (Google Identity Services). Solo pide cuentas del dominio institucional (`hd`);
 * el servidor vuelve a comprobar dominio, firma y cliente antes de abrir la sesión.
 */
@Component({
  selector: 'app-google-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.googleClientId()) {
      <div class="gwrap">
        <div #host class="gbtn" [class.hidden]="!ready()"></div>
        @if (!ready() && !failed()) { <span class="skeleton gsk" aria-label="Cargando el botón de Google"></span> }
        @if (failed()) { <p class="field-hint">No se pudo cargar el ingreso con Google. Revisa tu conexión y recarga la página.</p> }
      </div>
    }
  `,
  styles: `
    .gwrap { display: grid; justify-items: center; min-height: 44px; }
    .gbtn { width: 100%; display: flex; justify-content: center; }
    .gbtn.hidden { visibility: hidden; height: 0; }
    .gsk { width: 100%; height: 44px; border-radius: 6px; }
  `,
})
export class GoogleButton {
  readonly session = inject(SessionService);
  readonly credential = output<string>();
  readonly ready = signal(false);
  readonly failed = signal(false);
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');

  constructor() {
    let done = false;
    effect(() => {
      const id = this.session.googleClientId();
      const el = this.host()?.nativeElement;
      if (!id || !el || done) return;
      done = true;
      loadGis().then(() => {
        const gid = window.google!.accounts.id;
        gid.initialize({
          client_id: id,
          callback: (r: { credential?: string }) => r.credential && this.credential.emit(r.credential),
          hd: this.session.emailDomain(),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });
        gid.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular',
          logo_alignment: 'left', locale: 'es', width: Math.min(380, el.clientWidth || 380) });
        this.ready.set(true);
      }, () => this.failed.set(true));
    });
    inject(DestroyRef).onDestroy(() => window.google?.accounts?.id?.cancel());
  }
}
