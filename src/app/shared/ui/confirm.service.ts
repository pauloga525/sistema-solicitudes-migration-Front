import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  /** Qué pasará y por qué es riesgoso: se muestra siempre en operaciones críticas. */
  risk: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Si se define, exige escribir un motivo de al menos esa cantidad de caracteres. */
  reasonMin?: number;
  reasonLabel?: string;
  /** Si se define, hay que escribir exactamente este texto para confirmar (operaciones irreversibles). */
  typeToConfirm?: string;
}

interface Pending extends ConfirmOptions { resolve: (v: string | null) => void; }

/** Confirmaciones con el riesgo explicado. Devuelve el motivo (o '' si no se pidió) o null si se cancela. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<Pending | null>(null);

  ask(opts: ConfirmOptions): Promise<string | null> {
    this.pending()?.resolve(null);
    return new Promise((resolve) => this.pending.set({ ...opts, resolve }));
  }

  close(value: string | null): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(value);
  }
}
