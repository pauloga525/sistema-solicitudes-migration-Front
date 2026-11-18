import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ImportSummary } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiMessage } from '../../../core/utils/errors';
import { AdminLayout } from '../shell/admin-layout';

@Component({
  selector: 'app-padron-page',
  imports: [AdminLayout, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-layout title="Padrón de estudiantes"
                      lede="Sube el Excel del padrón. La cédula se cifra antes de guardarse, el archivo se procesa en memoria y volver a subirlo actualiza en lugar de duplicar.">
      <div class="narrow">
        <p class="intro">Columnas esperadas: <span class="tag">IDCApellidos</span> <span class="tag">IDCEspecialidad</span> <span class="tag">IDCCurso</span> <span class="tag">IDCCedula</span></p>

        <section class="upload" [class.has]="!!file()" [class.drag]="dragging()"
                 (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
          <span class="uicon"><span class="material-symbols-outlined" aria-hidden="true">{{ file() ? 'description' : 'upload_file' }}</span></span>
          @if (file(); as f) {
            <p class="fname">{{ f.name }}</p><p class="fmeta tnum">{{ (f.size / 1024) | number: '1.0-0' }} KB</p>
          } @else {
            <p class="fname">Arrastra el archivo aquí o elígelo</p><p class="fmeta">.xlsx o .xls · máximo 5 MB</p>
          }
          <div class="uactions">
            <label class="btn btn-outline btn-sm" for="padron-file">Elegir archivo</label>
            <input #fileInput id="padron-file" class="sr-only" type="file" accept=".xlsx,.xls" (change)="onFile($event)" />
            <button type="button" class="btn btn-primary btn-sm" [disabled]="!file() || importing()" (click)="importar()">
              <span class="material-symbols-outlined" [class.spin]="importing()" aria-hidden="true">{{ importing() ? 'progress_activity' : 'upload' }}</span>
              {{ importing() ? 'Importando...' : 'Importar' }}
            </button>
          </div>
        </section>

        @if (error()) {
          <div class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</div>
        }

        @if (summary(); as s) {
          <section class="summary" aria-live="polite">
            <h2>Resumen de la importación</h2>
            <dl class="stats tnum">
              <div><dt>Total filas</dt><dd>{{ s.total }}</dd></div>
              <div class="ok"><dt>Creados</dt><dd>{{ s.creados }}</dd></div>
              <div class="upd"><dt>Actualizados</dt><dd>{{ s.actualizados }}</dd></div>
              <div class="bad"><dt>Errores</dt><dd>{{ s.errores.length }}</dd></div>
            </dl>
            @if (s.errores.length > 0) {
              <ul class="errors">
                @for (e of s.errores; track $index) { <li><span class="row tnum">Fila {{ e.fila }}</span>{{ e.motivo }}</li> }
              </ul>
            }
          </section>
        }
      </div>
    </app-admin-layout>
  `,
  styles: `
    .narrow { width: 100%; max-width: 820px; display: grid; gap: 16px; }
    .intro { color: var(--on-surface-variant); max-width: 70ch; }
    .upload { display: grid; justify-items: center; text-align: center; gap: 6px; padding: 36px 24px; border-radius: var(--radius-lg);
      border: 2px dashed var(--outline-variant); background: var(--surface-container-lowest); transition: border-color var(--dur-fast), background var(--dur-fast); }
    .upload.drag, .upload.has { border-color: var(--primary-container); background: var(--primary-fixed); }
    .uicon { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 50%; background: var(--surface-container); color: var(--primary-container);
      margin-bottom: 6px; .material-symbols-outlined { font-size: 28px; } }
    .has .uicon { background: var(--surface-container-lowest); }
    .fname { font: var(--title-md); color: var(--on-surface); word-break: break-all; }
    .fmeta { color: var(--on-surface-variant); }
    .uactions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; justify-content: center; }
    label.btn { cursor: pointer; }
    .summary { background: var(--surface-container-lowest); border: 1px solid var(--outline-variant); border-radius: var(--radius-lg); padding: 22px; display: grid; gap: 16px;
      h2 { font: var(--title-md); font-weight: 700; } }
    .stats { margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    @media (max-width: 560px) { .stats { grid-template-columns: 1fr 1fr; } }
    .stats div { padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-container-low); }
    .stats dt { font: var(--label-md); color: var(--on-surface-variant); }
    .stats dd { margin: 2px 0 0; font: var(--headline-md); color: var(--on-surface); }
    .ok dd { color: var(--primary-container); } .upd dd { color: var(--tertiary); } .bad dd { color: var(--error); }
    .errors { list-style: none; margin: 0; padding: 0; max-height: 280px; overflow: auto; border-top: 1px solid var(--surface-container-high); }
    .errors li { display: flex; gap: 12px; padding: 8px 2px; border-bottom: 1px solid var(--surface-container-high); color: var(--on-surface-variant); }
    .row { flex: none; min-width: 64px; font: var(--label-md); color: var(--on-surface); }
  `,
})
export class PadronPage {
  private readonly api = inject(AdminApiService);
  readonly file = signal<File | null>(null);
  readonly importing = signal(false);
  readonly dragging = signal(false);
  readonly error = signal<string | null>(null);
  readonly summary = signal<ImportSummary | null>(null);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private select(f: File | null) {
    this.file.set(f);
    this.summary.set(null);
    this.error.set(null);
  }

  onFile(ev: Event) {
    this.select((ev.target as HTMLInputElement).files?.[0] ?? null);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
    this.select(ev.dataTransfer?.files?.[0] ?? null);
  }

  async importar() {
    const f = this.file();
    if (!f) return;
    this.importing.set(true);
    this.error.set(null);
    this.summary.set(null);
    try {
      this.summary.set(await this.api.importPadron(f));
      this.file.set(null);
      this.fileInput().nativeElement.value = '';
    } catch (err) {
      this.error.set(apiMessage(err, 'No se pudo importar el archivo.'));
    } finally {
      this.importing.set(false);
    }
  }
}
