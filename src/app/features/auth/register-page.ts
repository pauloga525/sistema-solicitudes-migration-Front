import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { apiMessage } from '../../core/utils/errors';
import { AuthFrame } from './auth-frame';
import { GoogleButton } from './google-button';
import { passwordRules } from './password-rules';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, AuthFrame, GoogleButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-frame.scss',
  template: `
    <app-auth-frame heading="Crea tu cuenta" [sub]="'Solo para estudiantes, con tu correo nombreapellido' + session.studentEmailSuffix() + '@' + session.emailDomain() + '. Después te pediremos tus datos y los de tu representante.'">
      @if (session.googleClientId()) {
        <div class="sso">
          <app-google-button (credential)="google($event)" />
          @if (googleError()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ googleError() }}</p> }
        </div>
        @if (session.passwordRegistration()) { <p class="divider"><span>o crea una contraseña</span></p> }
      }
      @if (session.passwordRegistration()) {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="field-label" for="email">Correo institucional</label>
          <div class="with-icon">
            <span class="material-symbols-outlined lead" aria-hidden="true">mail</span>
            <input id="email" class="input" type="email" formControlName="email" [placeholder]="'nombreapellido' + session.studentEmailSuffix() + '@' + session.emailDomain()"
                   autocomplete="email" autocapitalize="none" spellcheck="false" required aria-describedby="email-hint"
                   [class.invalid]="form.controls.email.touched && !emailOk()" />
          </div>
          <span id="email-hint" class="field-hint">Debe terminar en {{ session.studentEmailSuffix() }}&#64;{{ session.emailDomain() }}</span>
        </div>
        <div class="field">
          <label class="field-label" for="pw">Contraseña</label>
          <div class="with-icon">
            <span class="material-symbols-outlined lead" aria-hidden="true">lock</span>
            <input id="pw" class="input" type="password" formControlName="password" autocomplete="new-password" required aria-describedby="pw-rules" />
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="pw2">Repite la contraseña</label>
          <div class="with-icon">
            <span class="material-symbols-outlined lead" aria-hidden="true">lock</span>
            <input id="pw2" class="input" type="password" formControlName="confirm" autocomplete="new-password" required />
          </div>
          <ul class="rules" id="pw-rules">
            @for (r of rules(); track r.text) { <li [class.ok]="r.ok">{{ r.ok ? '✓' : '•' }} {{ r.text }}</li> }
          </ul>
        </div>
        @if (error()) {
          <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p>
        }
        <button type="submit" class="btn btn-primary btn-block submit" [disabled]="loading()">
          @if (loading()) { <span class="material-symbols-outlined spin" aria-hidden="true">progress_activity</span>Creando cuenta… }
          @else { Crear cuenta <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span> }
        </button>
      </form>
      } @else if (!session.googleClientId()) {
        <p class="alert alert-info notice"><span class="material-symbols-outlined" aria-hidden="true">info</span>El registro no está disponible. Pide ayuda a la institución.</p>
      }
      <div class="links"><span>¿Ya tienes cuenta? <a routerLink="/ingresar">Ingresa</a></span>
        @if (session.googleClientId()) { <span>Con Google no necesitas registrarte: tu cuenta se crea al ingresar por primera vez.</span> }</div>
    </app-auth-frame>
  `,
})
export class RegisterPage {
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly googleError = signal<string | null>(null);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true }),
    confirm: new FormControl('', { nonNullable: true }),
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly emailOk = computed(() => (this.v().email ?? '').trim().toLowerCase().endsWith(this.session.studentEmailSuffix() + '@' + this.session.emailDomain()));
  readonly rules = computed(() => passwordRules(this.v().password ?? '', this.v().confirm ?? '', this.v().email));

  async google(credential: string) {
    this.googleError.set(null);
    try {
      const to = await this.session.loginWithGoogle(credential);
      await this.session.load();
      await this.router.navigateByUrl(to, { replaceUrl: true });
    } catch (err) {
      this.googleError.set(apiMessage(err, 'No pudimos ingresar con Google.'));
    }
  }

  async submit() {
    this.form.markAllAsTouched();
    if (!this.emailOk()) {
      this.error.set(`Usa tu correo institucional de estudiante (${this.session.studentEmailSuffix()}@${this.session.emailDomain()}).`);
      return;
    }
    if (!this.rules().every((r) => r.ok)) {
      this.error.set('Revisa las condiciones de la contraseña.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      const { email, password, confirm } = this.form.getRawValue();
      const to = await this.session.register(email.trim(), password, confirm);
      await this.router.navigateByUrl(to, { replaceUrl: true });
    } catch (err) {
      this.error.set(apiMessage(err, 'No pudimos crear la cuenta.'));
    } finally {
      this.loading.set(false);
    }
  }
}
