import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const CAMPUSES = [
  { name: 'Campus Carlos Crespi', address: 'Calle Tarqui y Pío Bravo', phone: '072-844-207' },
  { name: 'Campus María Auxiliadora', address: 'Calle Vega Muñoz y Padre Aguirre', phone: '072-850-642' },
  { name: 'Campus Yanuncay', address: 'Av. Don Bosco y Felipe II', phone: '072-814-274 / 072-882-606' },
];

const MAPS = [
  { label: 'Campus Carlos Crespi', src: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3980!2d-79.00649746935194!3d-2.890576190306007!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91cd199217c41347%3A0x45d6ec59a2beec86!2sUnidad%20Educativa%20T%C3%A9cnico%20Salesiano%20-%20Campus%20Carlos%20Crespi!5e0!3m2!1ses!2sec!4v1780678109926!5m2!1ses!2sec' },
  { label: 'Campus María Auxiliadora', src: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3980!2d-79.00609740393985!3d-2.8919010227969015!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91cd199645d42d79%3A0xa07c641345f081e6!2sUnidad%20Educativa%20T%C3%A9cnico%20Salesiano%20-%20Campus%20Mar%C3%ADa%20Auxiliadora!5e0!3m2!1ses!2sec!4v1780678220852!5m2!1ses!2sec' },
  { label: 'Campus Yanuncay', src: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3980!2d-79.01642203237041!3d-2.9156254561750115!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91cd187974d0ee41%3A0x5ee9dceea7b23bcd!2sUnidad%20Educativa%20T%C3%A9cnico%20Salesiano!5e0!3m2!1ses!2sec!4v1780678241925!5m2!1ses!2sec' },
];

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/uetscuenca', path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z', fill: true },
  { label: 'Instagram', href: 'https://www.instagram.com/uetscuenca', path: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm9 9.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01', fill: false },
  { label: 'TikTok', href: 'https://www.tiktok.com/@uetscuenca', path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.84a8.18 8.18 0 0 0 4.78 1.52V6.9a4.85 4.85 0 0 1-1.01-.21z', fill: true },
  { label: 'YouTube', href: 'https://www.youtube.com/c/UET%C3%A9cnicoSalesiano', path: 'M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z', fill: true },
  { label: 'X', href: 'https://x.com/uetscue', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z', fill: true },
  { label: 'Spotify', href: 'https://open.spotify.com/intl-es/artist/5gLwRDP95HalLhHv7P6eeC', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 14.36c-.2.32-.62.42-.94.22-2.56-1.56-5.78-1.92-9.58-1.05-.36.08-.72-.14-.8-.5-.08-.36.14-.72.5-.8 4.16-.95 7.73-.54 10.6 1.19.32.2.42.62.22.94zm1.24-2.77c-.24.38-.76.5-1.14.26-2.93-1.8-7.4-2.32-10.87-1.27-.42.12-.86-.12-.98-.54-.12-.42.12-.86.54-.98 3.96-1.2 8.89-.62 12.23 1.45.38.24.5.76.22 1.08zm.11-2.88C14.53 8.6 8.78 8.41 5.46 9.42c-.5.15-1.03-.13-1.18-.63-.15-.5.13-1.03.63-1.18 3.81-1.16 10.15-.94 14.12 1.42.45.27.6.85.33 1.3-.26.45-.85.6-1.3.33z', fill: true },
];

@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="foot">
      <div class="container grid">
        <div class="col brand">
          <p class="name">Unidad Educativa Técnico Salesiano</p>
          <p class="motto">¡Cómo no te voy a querer! #SomosElTécnicoDelFuturo</p>
          <img src="img/logo-tecnico-del-futuro.png" alt="Logo UETS — El Técnico del Futuro" width="300" height="101" loading="lazy" />
        </div>

        <div class="col">
          <h2 class="h">Nuestros Campus</h2>
          <ul class="campus">
            @for (c of campuses; track c.name) {
              <li>
                <p class="cname">{{ c.name }}</p>
                <p class="meta"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>{{ c.address }}</p>
                <p class="meta tnum"><span class="material-symbols-outlined" aria-hidden="true">call</span>{{ c.phone }}</p>
              </li>
            }
          </ul>
        </div>

        <div class="col">
          <h2 class="h">Redes Sociales</h2>
          <div class="social">
            @for (s of social; track s.label) {
              <a [href]="s.href" target="_blank" rel="noopener noreferrer" [attr.aria-label]="s.label">
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"
                  [attr.fill]="s.fill ? 'currentColor' : 'none'" [attr.stroke]="s.fill ? null : 'currentColor'"
                  [attr.stroke-width]="s.fill ? null : 2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="s.path" /></svg>
              </a>
            }
          </div>

          <div class="maps">
            <div class="maps-head">
              <h2 class="h">Ubícanos</h2>
              <div class="arrows">
                <button type="button" class="arrow" (click)="prev()" aria-label="Mapa anterior"><span class="material-symbols-outlined">chevron_left</span></button>
                <button type="button" class="arrow" (click)="next()" aria-label="Mapa siguiente"><span class="material-symbols-outlined">chevron_right</span></button>
              </div>
            </div>
            <p class="map-label">{{ maps[current()].label }}</p>
            <div class="frame">
              @for (m of [maps[current()]]; track m.label) {
                <iframe [src]="safe[current()]" [title]="m.label" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
              }
            </div>
            <div class="dots" role="tablist" aria-label="Mapas de los campus">
              @for (m of maps; track m.label; let i = $index) {
                <button type="button" role="tab" [class.on]="i === current()" [attr.aria-selected]="i === current()"
                  [attr.aria-label]="'Ver mapa ' + m.label" (click)="current.set(i)"></button>
              }
            </div>
          </div>
        </div>
      </div>
      <div class="container legal">© {{ year }} Unidad Educativa Técnico Salesiano - Departamento de Sistemas. Todos los derechos reservados.</div>
    </footer>
  `,
  styles: `
    .foot { background: var(--inverse-surface); color: var(--inverse-on-surface); padding-top: 56px; }
    .grid { display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 48px; padding-bottom: 40px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; gap: 36px; } }
    .name { font: var(--title-md); }
    .motto { margin-top: 8px; color: #aeb6c4; font: var(--body-md); }
    .brand img { margin-top: 20px; width: min(300px, 100%); height: auto; }
    .h { font: var(--label-lg); color: var(--secondary-container); margin-bottom: 16px; }
    .campus { list-style: none; margin: 0; padding: 0; display: grid; gap: 18px; }
    .cname { font: var(--label-lg); margin-bottom: 4px; }
    .meta { display: flex; gap: 6px; align-items: flex-start; color: #aeb6c4; font: var(--body-md); }
    .meta .material-symbols-outlined { font-size: 16px; margin-top: 2px; }
    .social { display: flex; flex-wrap: wrap; gap: 10px; }
    .social a { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: #c4cbd8; background: rgb(255 255 255 / 7%);
      transition: background var(--dur-fast), color var(--dur-fast); }
    .social a:hover { background: var(--secondary-container); color: var(--on-secondary-container); }
    .maps { margin-top: 28px; }
    .maps-head { display: flex; align-items: center; justify-content: space-between; }
    .maps-head .h { margin: 0; }
    .arrows { display: flex; gap: 6px; }
    .arrow { width: 30px; height: 30px; border: 0; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
      background: rgb(255 255 255 / 8%); color: #c4cbd8; transition: background var(--dur-fast), color var(--dur-fast); }
    .arrow:hover { background: var(--secondary-container); color: var(--on-secondary-container); }
    .map-label { font: var(--label-md); margin: 10px 0 8px; }
    .frame { height: 180px; border-radius: var(--radius-md); overflow: hidden; background: #1b2a40; }
    .frame iframe { width: 100%; height: 180px; border: 0; display: block; }
    .dots { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
    .dots button { width: 8px; height: 8px; border-radius: 99px; border: 0; padding: 0; background: #4b5a72; cursor: pointer; transition: width var(--dur-med) var(--ease-out), background var(--dur-med); }
    .dots button.on { width: 22px; background: var(--secondary-container); }
    .legal { border-top: 1px solid rgb(255 255 255 / 10%); padding-block: 22px; text-align: center; color: #8d97a8; font: var(--body-md); }
  `,
})
export class SiteFooter {
  private readonly sanitizer = inject(DomSanitizer);
  readonly campuses = CAMPUSES;
  readonly social = SOCIAL;
  readonly maps = MAPS;
  // URLs fijas de Google Maps definidas en código (no provienen del usuario).
  readonly safe: SafeResourceUrl[] = MAPS.map((m) => this.sanitizer.bypassSecurityTrustResourceUrl(m.src));
  readonly current = signal(0);
  readonly year = new Date().getFullYear();

  prev() { this.current.update((i) => (i - 1 + MAPS.length) % MAPS.length); }
  next() { this.current.update((i) => (i + 1) % MAPS.length); }
}
