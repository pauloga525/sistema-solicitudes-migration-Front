import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { API_URL } from '../../core/config';
import { AuthFrame } from './auth-frame';

@Component({
  selector: 'app-maintenance-page',
  imports: [AuthFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-frame.scss',
  template: `
    <app-auth-frame heading="Estamos en mantenimiento" sub="Las solicitudes están pausadas por un momento.">
      <p class="alert alert-warning notice" role="status">
        <span class="material-symbols-outlined" aria-hidden="true">construction</span>
        {{ message() || 'Vuelve a intentarlo en unos minutos.' }}
      </p>
      <div class="links">
        <button type="button" class="btn btn-outline" (click)="retry()" [disabled]="checking()">
          {{ checking() ? 'Comprobando…' : 'Volver a intentar' }}
        </button>
        @if (session.user()) { <button type="button" class="btn btn-text" (click)="session.logout()">Cerrar sesión</button> }
      </div>
    </app-auth-frame>
  `,
})
export class MaintenancePage {
  readonly session = inject(SessionService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly message = signal<string | null>(this.session.maintenance().message);
  readonly checking = signal(false);

  constructor() {
    void this.refresh();
  }

  private async refresh(): Promise<boolean> {
    const m = await firstValueFrom(this.http.get<{ enabled: boolean; message: string | null }>(`${API_URL}/system/maintenance`)).catch(() => null);
    if (m) {
      this.message.set(m.message);
      this.session.maintenance.set(m);
    }
    return !!m && !m.enabled;
  }

  async retry() {
    this.checking.set(true);
    const open = await this.refresh();
    this.checking.set(false);
    if (open) void this.router.navigateByUrl(this.session.user()?.home ?? '/');
  }
}
