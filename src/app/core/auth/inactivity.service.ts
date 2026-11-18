import { Injectable, NgZone, inject } from '@angular/core';
import { SessionService } from './session.service';

export const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos
const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

/** Cierra la sesión tras 5 minutos sin actividad (port del temporizador de PrivateRoute). */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly session = inject(SessionService);
  private readonly zone = inject(NgZone);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private readonly reset = () => {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.zone.run(() => this.session.forceLogout('inactive')), INACTIVITY_MS);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    EVENTS.forEach((e) => document.addEventListener(e, this.reset, { passive: true, capture: true }));
    this.reset();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.timer);
    EVENTS.forEach((e) => document.removeEventListener(e, this.reset, { capture: true }));
  }
}
