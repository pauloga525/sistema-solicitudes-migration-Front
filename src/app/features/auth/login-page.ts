import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { apiMessage } from '../../core/utils/errors';
import { AuthFrame } from './auth-frame';
import { GoogleButton } from './google-button';

/** Ingreso solo con la cuenta institucional de Google. El formulario de contraseña aparece únicamente
 *  si el servidor lo permite (ALLOW_PASSWORD_LOGIN=true: cuentas de prueba o acceso de emergencia). */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthFrame, GoogleButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-frame.scss',
  template: `
    <app-auth-frame heading="Iniciar sesión" [sub]="'Usa tu cuenta institucional @' + session.emailDomain() + '.'">
      @if (motivo() === 'inactive') {
        <p class="alert alert-info notice" role="status"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>Cerramos tu sesión tras 5 minutos sin actividad.</p>
      } @else if (motivo() === 'expired') {
        <p class="alert alert-info notice" role="status"><span class="material-symbols-outlined" aria-hidden="true">lock_clock</span>Tu sesión terminó. Vuelve a ingresar.</p>
      } @else if (motivo() === 'password') {
        <p class="alert alert-success notice" role="status"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span>Contraseña actualizada. Ingresa con la nueva.</p>
      }

      @if (session.googleClientId()) {
        <div class="sso">
          <app-google-button (credential)="google($event)" />
          @if (googleBusy()) { <p class="field-hint" role="status">Verificando tu cuenta…</p> }
        </div>
      } @else {
        <p class="alert alert-info notice" role="status"><span class="material-symbols-outlined" aria-hidden="true">info</span>
          El ingreso con Google no está configurado todavía. Comunícate con el Departamento de Sistemas.</p>
      }

      @if (staff()) {
        <div class="alert alert-info staff" role="alert">
          <span class="material-symbols-outlined" aria-hidden="true">badge</span>
          <div><p class="staff-title">Hola, tu cuenta es de personal de la institución</p><p>{{ staff() }}</p></div>
        </div>
      } @else if (googleError()) {
        <p class="alert alert-error notice" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ googleError() }}</p>
      }

      <ul class="who">
        <li><strong>Estudiantes:</strong> ingresa con tu correo <span class="mail">nombreapellido{{ session.studentEmailSuffix() }}&#64;{{ session.emailDomain() }}</span>. La primera vez te pediremos tus datos y los de tu representante.</li>
        <li><strong>Docentes y personal administrativo:</strong> el acceso para revisar solicitudes lo habilita el Departamento de Sistemas.</li>
      </ul>

      @if (session.passwordLogin()) {
        <details class="pw" [open]="pwOpen()" (toggle)="pwOpen.set($any($event.target).open)">
          <summary>Ingresar con usuario y contraseña (cuentas de prueba)</summary>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="field-label" for="usuario">Correo o usuario</label>
              <div class="with-icon">
                <span class="material-symbols-outlined lead" aria-hidden="true">person</span>
                <input id="usuario" class="input" type="text" formControlName="username" placeholder="nombre@uets.edu.ec" autocomplete="username"
                       required autocapitalize="none" spellcheck="false"
                       [class.invalid]="form.controls.username.touched && form.controls.username.invalid" />
              </div>
            </div>
            <div class="field">
              <label class="field-label" for="password">Contraseña</label>
              <div class="with-icon">
                <span class="material-symbols-outlined lead" aria-hidden="true">lock</span>
                <input id="password" class="input pad-r" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="••••••••"
                       autocomplete="current-password" required [class.invalid]="form.controls.password.touched && form.controls.password.invalid" />
                <button type="button" class="icon-btn eye" (click)="showPassword.set(!showPassword())"
                        [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <span class="material-symbols-outlined">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>
            @if (error()) {
              <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p>
            }
            <button type="submit" class="btn btn-primary btn-block submit" [disabled]="loading()">
              @if (loading()) { <span class="material-symbols-outlined spin" aria-hidden="true">progress_activity</span>Verificando… }
              @else { Ingresar <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span> }
            </button>
          </form>
          @if (session.passwordRegistration()) {
            <p class="links"><span>¿Cuenta de prueba nueva? <a routerLink="/registro">Crea tu cuenta</a></span></p>
          }
        </details>
      }
    </app-auth-frame>
  `,
  styles: `
    .who { margin: 24px 0 0; padding-left: 18px; display: grid; gap: 8px; font: var(--body-md); color: var(--on-surface-variant); }
    .who strong { color: var(--on-surface); font-weight: 600; }
    .mail { white-space: nowrap; font-weight: 600; color: var(--on-surface); }
    .staff { margin-top: 20px; align-items: flex-start; }
    .staff p { margin: 0; }
    .staff-title { font-weight: 600; margin-bottom: 4px !important; }
    .pw { margin-top: 28px; border-top: 1px solid var(--outline-variant); padding-top: 16px; }
    .pw summary { cursor: pointer; font: var(--label-lg); color: var(--on-surface-variant); }
    .pw summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }
    .pw form { margin-top: 18px; }
  `,
})
export class LoginPage {
  readonly session = inject(SessionService);
  readonly googleBusy = signal(false);
  readonly googleError = signal<string | null>(null);
  /** Mensaje para docentes/administrativos sin acceso (su correo queda registrado para el SUPERADMIN). */
  readonly staff = signal<string | null>(null);
  private readonly router = inject(Router);
  readonly motivo = input<string | undefined>();
  readonly next = input<string | undefined>();
  readonly showPassword = signal(false);
  readonly pwOpen = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    try {
      const { username, password } = this.form.getRawValue();
      await this.finish(await this.session.login(username.trim(), password));
    } catch (err) {
      this.error.set(apiMessage(err, 'Usuario o contraseña incorrectos'));
    } finally {
      this.loading.set(false);
    }
  }

  async google(credential: string) {
    this.googleError.set(null);
    this.staff.set(null);
    this.googleBusy.set(true);
    try {
      await this.finish(await this.session.loginWithGoogle(credential));
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { code?: string } | null)?.code : undefined;
      if (code === 'STAFF_NOT_ENABLED') this.staff.set(apiMessage(err, ''));
      else this.googleError.set(apiMessage(err, 'No pudimos ingresar con Google.'));
    } finally {
      this.googleBusy.set(false);
    }
  }

  /** Destino tras ingresar (con Google o con contraseña). */
  private async finish(redirectTo: string) {
    let to = redirectTo;
    await this.session.load(); // trae también si el perfil del estudiante está completo
    const n = this.next();
    const u = this.session.user();
    // Solo se respeta `next` si es una ruta interna del mismo rol (sin redirecciones abiertas).
    if (n && n.startsWith('/') && !n.startsWith('//') && u && !u.forcePasswordChange &&
        ((u.role === 'STUDENT' && (n.startsWith('/estudiante') || n.startsWith('/solicitud'))) ||
         (u.role !== 'STUDENT' && n.startsWith('/admin')) || (u.role === 'SUPERADMIN' && n.startsWith('/superadmin')))) {
      to = n;
    }
    if (u?.role === 'STUDENT' && !u.profileCompleted && !u.forcePasswordChange) to = '/estudiante/perfil';
    await this.router.navigateByUrl(to, { replaceUrl: true });
  }
}
