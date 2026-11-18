import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const SLIDES = [
  { src: 'img/carlos.webp', label: 'Campus Carlos Crespi' },
  { src: 'img/maria.webp', label: 'Campus María Auxiliadora' },
  { src: 'img/yanu1.webp', label: 'Campus Yanuncay' },
  { src: 'img/yanu2.webp', label: 'Campus Yanuncay' },
];

/** Marco de las pantallas de cuenta: fotos de los campus a la izquierda, formulario a la derecha. */
@Component({
  selector: 'app-auth-frame',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-frame.scss',
  template: `
    <div class="login">
      <section class="visual" aria-hidden="true">
        @for (s of slides; track $index; let i = $index) {
          <img [src]="s.src" alt="" [class.on]="i === current()" width="1600" height="900" />
        }
        <div class="shade"></div>
        <div class="visual-copy">
          <img class="crest" src="img/escudo-uets.png" alt="" width="88" height="88" />
          <h1>Solicitudes académicas UETS</h1>
          <p>Estudiantes, docentes y administración en un mismo lugar. Tus datos personales se guardan cifrados.</p>
          <span class="pill"><span class="material-symbols-outlined filled">verified_user</span>Conexión protegida</span>
        </div>
        <p class="campus-label">{{ slides[current()].label }}</p>
      </section>
      <section class="panel-side">
        <div class="box">
          <a routerLink="/" aria-label="Ir al inicio"><img class="crest-sm" src="img/escudo-uets.png" alt="Escudo UETS" width="64" height="64" /></a>
          <h2>{{ heading() }}</h2>
          @if (sub()) { <p class="sub">{{ sub() }}</p> }
          <ng-content />
        </div>
      </section>
    </div>
  `,
})
export class AuthFrame {
  readonly heading = input.required<string>();
  readonly sub = input<string>('');
  readonly slides = SLIDES;
  readonly current = signal(0);

  constructor() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => this.current.update((i) => (i + 1) % SLIDES.length), 6000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }
}
