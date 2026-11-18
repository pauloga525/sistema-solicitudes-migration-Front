import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SiteFooter } from '../../../shared/components/site-footer';
import { SiteNavbar } from '../../../shared/components/site-navbar';

const SLIDES = [
  { src: 'img/carlos.webp', label: 'Campus Carlos Crespi' },
  { src: 'img/maria.webp', label: 'Campus María Auxiliadora' },
  { src: 'img/yanu1.webp', label: 'Campus Yanuncay' },
  { src: 'img/yanu2.webp', label: 'Campus Yanuncay' },
];
const INTERVAL_MS = 2500;

const STEPS = [
  { icon: 'location_on', label: 'Seleccionar Campus', text: 'Elige la sede donde te encuentras matriculado actualmente.' },
  { icon: 'badge', label: 'Ingresar ID', text: 'Ingresa tu número de identificación estudiantil único.' },
  { icon: 'fact_check', label: 'Revisar Info', text: 'Valida que todos tus datos personales sean correctos.' },
  { icon: 'download', label: 'Enviar y Descargar', text: 'Finaliza el trámite y obtén tu comprobante en formato PDF.' },
];

const INFO = [
  { title: 'Documento de Identidad', text: 'Tener a mano su documento de identidad y de su representado.' },
  { title: 'Correo Institucional', text: 'Debe tener acceso activo para recibir notificaciones.' },
  { title: 'Tiempos de Respuesta', text: 'Entre 24 y 72 horas hábiles según el tipo de trámite.' },
];

const TRAMITES = [
  { icon: 'description', label: 'Certificados', text: 'Notas, conducta, matrícula y egreso.' },
  { icon: 'person_add', label: 'Matrículas', text: 'Renovación, extemporáneas y reingresos.' },
  { icon: 'edit_square', label: 'Cambios de información', text: 'Actualización de datos personales y contacto.' },
  { icon: 'list_alt', label: 'Solicitudes académicas', text: 'Homologaciones, retiros y aplazamientos.' },
  { icon: 'menu_book', label: 'Documentos institucionales', text: 'Manuales de convivencia, reglamentos y circulares oficiales.' },
];

@Component({
  selector: 'app-landing-page',
  imports: [SiteNavbar, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})
export class LandingPage {
  private readonly router = inject(Router);
  readonly slides = SLIDES;
  readonly steps = STEPS;
  readonly info = INFO;
  readonly tramites = TRAMITES;
  readonly current = signal(0);
  private paused = false;

  constructor() {
    const timer = setInterval(() => {
      if (!this.paused) this.current.update((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  pause(v: boolean) { this.paused = v; }
  start() { void this.router.navigate(['/solicitud']); }
}
