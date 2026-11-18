import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { apiMessage } from '../../../core/utils/errors';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { fmtDateTime } from '../../../shared/ui/format';
import { SkeletonRows } from '../../../shared/ui/states';
import { ToastService } from '../../../shared/ui/toast.service';
import { SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-settings',
  imports: [FormsModule, RouterLink, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Configuración</h1><p class="lede">Cada cambio queda registrado en la auditoría con tu nombre.</p></div></div>
    @if (s(); as x) {
      <div class="split">
        <section class="section" [class.on]="x.maintenance.enabled">
          <header><h2>Modo mantenimiento</h2>
            <span class="end">@if (x.maintenance.enabled) { <span class="tag warn">Activo</span> } @else { <span class="tag ok">Sistema abierto</span> }</span></header>
          <div class="body stack">
            <p>Mientras esté activo, los estudiantes no pueden ingresar ni registrarse y ven el mensaje de abajo. Administradores y super administradores siguen trabajando.</p>
            @if (x.maintenance.enabled) {
              <p class="muted">Activado el {{ dt(x.maintenance.enabledAt) }}@if (x.maintenance.enabledByName) { por {{ x.maintenance.enabledByName }} }.</p>
            }
            <label class="field"><span class="field-label">Mensaje para los estudiantes</span>
              <textarea class="textarea" rows="2" maxlength="300" [(ngModel)]="msg" placeholder="Ej.: Estamos actualizando el sistema. Volvemos a las 18:00."></textarea></label>
            <div class="form-actions">
              @if (x.maintenance.enabled) {
                <button type="button" class="btn btn-success" (click)="setMaint(false)" [disabled]="busy()">Desactivar mantenimiento</button>
              } @else {
                <button type="button" class="btn btn-danger" (click)="setMaint(true)" [disabled]="busy()">Activar mantenimiento</button>
              }
            </div>
          </div>
        </section>
        <section class="section"><header><h2>Parámetros generales</h2></header>
          <form class="body stack" (submit)="$event.preventDefault(); saveParams()">
            <dl class="kv">
              <dt>Periodo vigente</dt><dd>@if (x.activePeriod; as p) { {{ p.anio }} · {{ p.trimestre }} · {{ p.aporte }} } @else { Ninguno }
                <a routerLink="/admin/plazos" class="small">Editar calendario</a></dd>
              <dt>Correo institucional</dt><dd>&#64;{{ x.emailDomain }}</dd>
              <dt>Zona horaria</dt><dd>{{ x.timezone }}</dd>
              <dt>Límites</dt><dd><a routerLink="/superadmin/plazos">Plazos y límites</a></dd>
            </dl>
            <label class="field"><span class="field-label">Plazo de atención por defecto (días)</span>
              <input class="input" type="number" min="1" max="90" name="due" [(ngModel)]="p.dueDaysDefault" placeholder="Sin plazo automático" />
              <span class="field-hint">Se asigna a cada solicitud nueva. Vacío: sin plazo.</span></label>
            <h3>Retención automática</h3>
            <div class="row">
              <label class="field"><span class="field-label">Auditoría de cuentas (días)</span><input class="input" type="number" min="180" max="3650" name="ua" [(ngModel)]="p.userAuditRetentionDays" /></label>
              <label class="field"><span class="field-label">Errores (días)</span><input class="input" type="number" min="30" max="730" name="er" [(ngModel)]="p.errorRetentionDays" /></label>
            </div>
            <p class="field-hint">Intentos de ingreso: {{ x.retention.rateLimitRetentionHours }} h. Los eventos de solicitudes no se borran nunca.</p>
            <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="busy()">Guardar parámetros</button></div>
          </form>
        </section>
      </div>
    } @else { <app-skeleton-rows [rows]="6" [cols]="2" /> }
  `,
  styles: `
    .stack { display: grid; gap: 12px; } .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .section.on { border-color: #e0a100; box-shadow: 0 0 0 1px #e0a100 inset; }
    h3 { font: var(--title-md); margin-top: 4px; } .small { margin-left: 8px; font: var(--label-md); }
  `,
})
export class SettingsPage {
  private readonly api = inject(SaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  readonly s = signal<any>(null);
  readonly busy = signal(false);
  readonly dt = fmtDateTime;
  msg = '';
  p: { dueDaysDefault: number | null; userAuditRetentionDays: number; errorRetentionDays: number } = { dueDaysDefault: null, userAuditRetentionDays: 730, errorRetentionDays: 180 };

  constructor() { void this.load(); }
  private apply(x: any) {
    this.s.set(x);
    this.msg = x.maintenance.message ?? '';
    this.p = { dueDaysDefault: x.dueDaysDefault ?? null, userAuditRetentionDays: x.retention.userAuditRetentionDays, errorRetentionDays: x.retention.errorRetentionDays };
    this.session.maintenance.set({ enabled: x.maintenance.enabled, message: x.maintenance.message });
  }
  async load() { try { this.apply(await this.api.settings()); } catch (e) { this.toast.error(apiMessage(e)); } }

  async setMaint(on: boolean) {
    if (on) {
      const r = await this.confirm.ask({ title: 'Activar mantenimiento', confirmLabel: 'Activar',
        risk: 'Los estudiantes con sesión abierta pierden el acceso de inmediato y nadie podrá registrarse ni enviar solicitudes hasta que lo desactives.' });
      if (r === null) return;
    }
    this.busy.set(true);
    try { this.apply(await this.api.maintenance(on, this.msg.trim() || null)); this.toast.ok(on ? 'Mantenimiento activado' : 'Sistema abierto otra vez'); }
    catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }

  async saveParams() {
    this.busy.set(true);
    try {
      const due = this.p.dueDaysDefault ? Number(this.p.dueDaysDefault) : null;
      this.apply(await this.api.params({ dueDaysDefault: due, userAuditRetentionDays: Number(this.p.userAuditRetentionDays), errorRetentionDays: Number(this.p.errorRetentionDays) }));
      this.toast.ok('Parámetros guardados');
    } catch (e) { this.toast.error(apiMessage(e)); } finally { this.busy.set(false); }
  }
}
