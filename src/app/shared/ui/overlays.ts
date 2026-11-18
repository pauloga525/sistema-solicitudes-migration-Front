import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';

/** Capa global: notificaciones y diálogo de confirmación (un solo lugar para toda la app). */
@Component({
  selector: 'app-overlays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of toast.items(); track t.id) {
        <div class="toast" [class]="'toast t-' + t.kind">
          <span class="material-symbols-outlined" aria-hidden="true">{{ t.kind === 'error' ? 'error' : t.kind === 'info' ? 'info' : 'check_circle' }}</span>
          <span class="msg">{{ t.text }}</span>
          <button type="button" class="x" (click)="toast.dismiss(t.id)" aria-label="Cerrar aviso"><span class="material-symbols-outlined">close</span></button>
        </div>
      }
    </div>
    <dialog #dlg class="dialog confirm" (close)="onNativeClose()" aria-labelledby="cf-title" aria-describedby="cf-risk">
      @if (p(); as c) {
        <form method="dialog" (submit)="$event.preventDefault(); accept()">
          <div class="dialog-head">
            <span class="ic" [class.danger]="c.tone !== 'primary'" aria-hidden="true"><span class="material-symbols-outlined">{{ c.tone === 'primary' ? 'help' : 'warning' }}</span></span>
            <h2 id="cf-title">{{ c.title }}</h2>
          </div>
          <div class="dialog-body">
            <p id="cf-risk" class="risk">{{ c.risk }}</p>
            @if (c.reasonMin) {
              <label class="field">
                <span class="field-label">{{ c.reasonLabel || 'Motivo' }} <span class="req">(obligatorio, mínimo {{ c.reasonMin }} caracteres)</span></span>
                <textarea class="textarea" [value]="reason()" (input)="reason.set($any($event.target).value)" maxlength="500" rows="3" required></textarea>
                <span class="field-hint">{{ reason().trim().length }}/{{ c.reasonMin }}</span>
              </label>
            }
            @if (c.typeToConfirm) {
              <label class="field">
                <span class="field-label">Para confirmar, escribe <strong class="typed">{{ c.typeToConfirm }}</strong></span>
                <input class="input" [value]="typed()" (input)="typed.set($any($event.target).value)" autocomplete="off" spellcheck="false" />
              </label>
            }
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="cancel()">Cancelar</button>
            <button type="submit" class="btn" [class.btn-danger]="c.tone !== 'primary'" [class.btn-primary]="c.tone === 'primary'" [disabled]="!canAccept()">
              {{ c.confirmLabel }}
            </button>
          </div>
        </form>
      }
    </dialog>
  `,
  styles: `
    .toasts { position: fixed; z-index: 1000; right: 16px; bottom: 16px; display: grid; gap: 8px; width: min(380px, calc(100vw - 32px)); }
    .toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 10px 12px 14px; border-radius: var(--radius-md);
      background: var(--inverse-surface); color: var(--inverse-on-surface); box-shadow: var(--elev-3); font: var(--body-md);
      animation: toast-in 220ms var(--ease-out); }
    .toast .material-symbols-outlined { font-size: 20px; }
    .t-ok > .material-symbols-outlined { color: #7fd8a0; }
    .t-error > .material-symbols-outlined { color: #ffb4ab; }
    .t-info > .material-symbols-outlined { color: var(--primary-fixed-dim); }
    .msg { flex: 1; padding-top: 1px; }
    .x { border: 0; background: none; color: inherit; opacity: 0.7; cursor: pointer; border-radius: 6px; display: grid; place-items: center;
      .material-symbols-outlined { font-size: 18px; } }
    .x:hover { opacity: 1; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
    .confirm h2 { font: var(--title-lg); }
    .typed { font-family: var(--font-mono, ui-monospace, monospace); word-break: break-all; }
    .ic { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--primary-fixed); color: var(--primary); flex: none; }
    .ic.danger { background: var(--error-container); color: var(--error); }
    .risk { color: var(--on-surface-variant); }
    .req { font-weight: 400; color: var(--on-surface-variant); }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class Overlays {
  readonly toast = inject(ToastService);
  readonly confirm = inject(ConfirmService);
  readonly p = this.confirm.pending;
  readonly reason = signal('');
  readonly typed = signal('');
  readonly canAccept = computed(() => {
    const p = this.p();
    const reasonOk = !p?.reasonMin || this.reason().trim().length >= (p?.reasonMin ?? 0);
    const typedOk = !p?.typeToConfirm || this.typed().trim() === p.typeToConfirm;
    return reasonOk && typedOk;
  });
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.p()) {
        this.reason.set('');
        this.typed.set('');
        if (!d.open) d.showModal();
      } else if (d.open) d.close();
    });
  }

  accept() {
    if (this.canAccept()) this.confirm.close(this.reason().trim());
  }

  cancel() {
    this.confirm.close(null);
  }

  onNativeClose() {
    if (this.p()) this.confirm.close(null); // Esc
  }
}
