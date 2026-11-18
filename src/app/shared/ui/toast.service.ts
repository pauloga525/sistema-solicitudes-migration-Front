import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'ok' | 'error' | 'info'; text: string; }

/** Notificaciones breves (4 s; los errores 7 s). Se anuncian a lectores de pantalla. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'ok'): void {
    const id = ++this.seq;
    this.items.update((l) => [...l.slice(-2), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 7000 : 4000);
  }

  ok(text: string) { this.show(text, 'ok'); }
  error(text: string) { this.show(text, 'error'); }
  dismiss(id: number) { this.items.update((l) => l.filter((t) => t.id !== id)); }
}
