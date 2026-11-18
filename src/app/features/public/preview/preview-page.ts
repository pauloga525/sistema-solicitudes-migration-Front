import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CreateRequestPayload, ProcesoMejoraFormData } from '../../../core/models/models';
import { PublicApiService } from '../../../core/services/public-api.service';
import { apiMessage } from '../../../core/utils/errors';
import { printBlob } from '../../../core/utils/pdf';
import { FormFooter } from '../../../shared/components/form-footer';

type Stage = 'loading' | 'preview' | 'submitting' | 'success' | 'error';

/** Partículas de la pantalla de éxito (mismas posiciones y colores que el original). */
const PARTICLES = [
  { top: '8%', left: '5%', size: 12, color: '#002753', anim: 'f1', delay: '0s' },
  { top: '15%', left: '18%', size: 8, color: '#fccc38', anim: 'f3', delay: '0.5s' },
  { top: '5%', left: '40%', size: 10, color: '#002753', anim: 'f2', delay: '1s' },
  { top: '20%', left: '60%', size: 7, color: '#fccc38', anim: 'f4', delay: '0.3s' },
  { top: '10%', right: '8%', size: 12, color: '#fccc38', anim: 'f1', delay: '1.5s' },
  { top: '30%', right: '5%', size: 8, color: '#002753', anim: 'f3', delay: '0.8s' },
  { top: '45%', left: '3%', size: 10, color: '#fccc38', anim: 'f2', delay: '0.2s' },
  { top: '55%', right: '4%', size: 8, color: '#002753', anim: 'f4', delay: '1.2s' },
  { top: '70%', left: '10%', size: 12, color: '#002753', anim: 'f1', delay: '0.7s' },
  { top: '75%', left: '30%', size: 7, color: '#fccc38', anim: 'f3', delay: '0s' },
  { top: '65%', right: '15%', size: 10, color: '#fccc38', anim: 'f2', delay: '1.8s' },
  { top: '85%', right: '6%', size: 8, color: '#002753', anim: 'f4', delay: '0.4s' },
  { top: '90%', left: '50%', size: 10, color: '#fccc38', anim: 'f1', delay: '1s' },
  { top: '40%', left: '45%', size: 7, color: '#002753', anim: 'f3', delay: '2s' },
];

@Component({
  selector: 'app-preview-page',
  imports: [FormFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-page.html',
  styleUrl: './preview-page.scss',
})
export class PreviewPage {
  private readonly api = inject(PublicApiService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly particles = PARTICLES;
  readonly stage = signal<Stage>('loading');
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly requestNumber = signal('');
  readonly requestId = signal('');
  readonly errorMsg = signal('');
  readonly printing = signal(false);
  readonly fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  private pdfToken = '';
  private objectUrl: string | null = null;
  private readonly formData: ProcesoMejoraFormData | undefined = (history.state as { formData?: ProcesoMejoraFormData })?.formData;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrl && URL.revokeObjectURL(this.objectUrl));
    if (!this.formData) {
      void this.router.navigate(['/solicitud']);
      return;
    }
    this.api.previewPdf(this.payload()).then(
      (blob) => {
        this.objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        // URL blob: generada localmente a partir de la respuesta del propio backend.
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`${this.objectUrl}#toolbar=0&navpanes=0&scrollbar=0`));
        this.stage.set('preview');
      },
      () => {
        this.errorMsg.set('No se pudo generar la vista previa.');
        this.stage.set('error');
      },
    );
  }

  private payload(): CreateRequestPayload {
    const f = this.formData!;
    return {
      requestType: 'proceso_mejora',
      representativeName: f.representativeName.trim(),
      representativeDni: f.representativeDni.trim(),
      studentName: f.studentName.trim(),
      studentDni: f.studentDni.trim(),
      course: f.course,
      paralelo: f.paralelo,
      payload: { subjects: f.subjects },
    };
  }

  async submit() {
    if (this.stage() === 'submitting') return;
    this.stage.set('submitting');
    try {
      const data = await this.api.createRequest(this.payload());
      this.requestNumber.set(data.requestNumber);
      this.requestId.set(data._id);
      this.pdfToken = data.pdfAccessToken ?? '';
      this.stage.set('success');
    } catch (err) {
      this.errorMsg.set(apiMessage(err, 'Error al enviar la solicitud.'));
      this.stage.set('error');
    }
  }

  modificar() {
    void this.router.navigate(['/solicitud/formulario'], { state: { formData: this.formData } });
  }

  descargar() {
    window.open(this.api.pdfUrlWithToken(this.requestId(), this.pdfToken), '_blank');
  }

  async imprimir() {
    this.printing.set(true);
    try {
      printBlob(await this.api.getPdfWithToken(this.requestId(), this.pdfToken));
    } catch {
      this.errorMsg.set('No se pudo preparar la impresión. Intente con "Descargar PDF".');
    } finally {
      this.printing.set(false);
    }
  }

  go(path: string) {
    void this.router.navigate([path]);
  }

  get ref(): string {
    return this.requestId().slice(-10).toUpperCase();
  }
}
