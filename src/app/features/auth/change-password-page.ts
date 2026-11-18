import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { apiMessage } from '../../core/utils/errors';
import { AuthFrame } from './auth-frame';
import { passwordRules } from './password-rules';

@Component({
  selector: 'app-change-password-page',
  imports: [ReactiveFormsModule, RouterLink, AuthFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-frame.scss',
  template: `
    <app-auth-frame heading="Cambia tu contraseña"
                    [sub]="forced() ? 'Estás usando una contraseña temporal. Elige una nueva para continuar.' : 'Al guardarla se cerrarán tus sesiones abiertas.'">
      @if (!session.user()) {
        <p class="alert alert-info notice"><span class="material-symbols-outlined" aria-hidden="true">info</span>Primero ingresa con tu cuenta.</p>
        <div class="links"><a routerLink="/ingresar">Ir a ingresar</a></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (!forced()) {
            <div class="field">
              <label class="field-label" for="cur">Contraseña actual</label>
              <input id="cur" class="input" type="password" formControlName="current" autocomplete="current-password" required />
            </div>
          }
          <div class="field">
            <label class="field-label" for="new">Nueva contraseña</label>
            <input id="new" class="input" type="password" formControlName="password" autocomplete="new-password" required aria-describedby="pw-rules" />
          </div>
          <div class="field">
            <label class="field-label" for="new2">Repite la nueva contraseña</label>
            <input id="new2" class="input" type="password" formControlName="confirm" autocomplete="new-password" required />
            <ul class="rules" id="pw-rules">
              @for (r of rules(); track r.text) { <li [class.ok]="r.ok">{{ r.ok ? '✓' : '•' }} {{ r.text }}</li> }
            </ul>
          </div>
          @if (error()) {
            <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p>
          }
          <button type="submit" class="btn btn-primary btn-block submit" [disabled]="loading()">
            @if (loading()) { <span class="material-symbols-outlined spin" aria-hidden="true">progress_activity</span>Guardando… } @else { Guardar contraseña }
          </button>
        </form>
        <div class="links"><button type="button" class="btn btn-text" (click)="session.logout()">Salir sin cambiarla</button></div>
      }
    </app-auth-frame>
  `,
})
export class ChangePasswordPage {
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly forced = computed(() => !!this.session.user()?.forcePasswordChange);
  readonly form = new FormGroup({
    current: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    confirm: new FormControl('', { nonNullable: true }),
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly rules = computed(() => [
    ...passwordRules(this.v().password ?? '', this.v().confirm ?? '', this.session.user()?.email),
    ...(this.forced() ? [] : [{ text: 'Distinta de la actual', ok: !!this.v().password && this.v().password !== this.v().current }]),
  ]);

  async submit() {
    if (!this.rules().every((r) => r.ok)) {
      this.error.set('Revisa las condiciones de la contraseña.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      const { current, password, confirm } = this.form.getRawValue();
      await this.session.changePassword(current, password, confirm);
      await this.router.navigate(['/ingresar'], { queryParams: { motivo: 'password' }, replaceUrl: true });
    } catch (err) {
      this.error.set(apiMessage(err, 'No pudimos cambiar la contraseña.'));
    } finally {
      this.loading.set(false);
    }
  }
}
