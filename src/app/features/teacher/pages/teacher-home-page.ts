import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COURSE_LABELS_LONG } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { fmtAgo } from '../../../shared/ui/format';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { TeacherApi } from '../teacher-api';
import { CLOSED_REQUEST, TRACK_LABELS, TRACK_ORDER, TeacherItem, TeacherNotification, TeacherProfile, TeacherSubject, TrackStatus } from '../teacher.models';
import { fmtSchedule, notificationIcon } from './teacher-format';

/** Inicio del docente: qué requiere acción, sus materias y las novedades. */
@Component({
  selector: 'app-teacher-home',
  imports: [RouterLink, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div>
      <h1>{{ greeting() }}</h1>
      <p class="lede">Aquí ves las evaluaciones de mejora que los estudiantes solicitaron en tus materias. Marca cada una cuando la programes y cuando la evalúes.</p>
    </div></div>

    @if (error()) { <p class="alert alert-error" role="alert"><span class="material-symbols-outlined" aria-hidden="true">error</span>{{ error() }}</p> }

    <div class="stages tri" role="group" aria-label="Mis solicitudes por seguimiento">
      @for (st of order; track st) {
        <a class="stage" [routerLink]="['/docente/solicitudes']" [queryParams]="{ track: st }" [class.now]="st === 'por_atender' && (counts()?.[st] ?? 0) > 0">
          @if (counts(); as c) { <span class="n">{{ c[st] }}</span> } @else { <span class="skeleton" style="height:28px;width:48px"></span> }
          <span class="key" [class]="'key t-' + st"><span class="sq" aria-hidden="true"></span>{{ labels[st] }}</span>
          <span class="cap">{{ st === 'por_atender' && (counts()?.[st] ?? 0) > 0 ? 'Requiere tu acción' : 'Ver lista' }}</span>
        </a>
      }
    </div>

    <div class="grid">
      <section class="section" aria-labelledby="subj-h">
        <header><span class="material-symbols-outlined hicon" aria-hidden="true">menu_book</span><h2 id="subj-h">Mis materias</h2>
          @if (subjects(); as s) { <span class="end"><span class="tag">{{ s.length }}</span></span> }</header>
        @if (subjects(); as s) {
          @if (s.length) {
            <ul class="subjects">
              @for (x of s; track x.key) {
                <li><a [routerLink]="['/docente/solicitudes']" [queryParams]="{ materia: x.key }">
                  <span class="sname"><strong>{{ x.subject }}</strong>
                    <small>{{ courseLabel(x.course) }} · paralelo {{ x.paralelo }}@if (x.specialty) { · {{ x.specialty }} }</small></span>
                  <span class="counts">
                    @if (x.nuevas) { <span class="tag gold">{{ x.nuevas }} {{ x.nuevas === 1 ? 'nueva' : 'nuevas' }}</span> }
                    <span class="tnum" [class.zero]="!x.porAtender"><b>{{ x.porAtender }}</b> por atender</span>
                    <span class="material-symbols-outlined chev" aria-hidden="true">chevron_right</span>
                  </span>
                </a></li>
              }
            </ul>
          } @else {
            <app-empty icon="menu_book" title="Aún no tienes materias asignadas" text="El Departamento de Sistemas carga las materias de cada docente desde el distributivo." />
          }
        } @else { <div class="body"><app-skeleton-rows [rows]="4" [cols]="2" /></div> }
      </section>

      <div class="side">
        <section class="section" aria-labelledby="news-h">
          <header><span class="material-symbols-outlined hicon" aria-hidden="true">notifications</span><h2 id="news-h">Novedades</h2>
            <span class="end"><a routerLink="/docente/notificaciones" class="hlink">Ver todas</a></span></header>
          @if (news(); as n) {
            @if (n.length) {
              <ul class="news">
                @for (x of n.slice(0, 5); track x.id) {
                  <li [class.unread]="!x.read">
                    <span class="material-symbols-outlined ic" [class.muted]="x.kind === 'cancelada' || x.kind === 'rechazada'" aria-hidden="true">{{ icon(x.kind) }}</span>
                    <span class="txt"><strong>{{ x.title }}</strong><small>{{ x.body }}</small></span>
                    <span class="when">{{ ago(x.createdAt) }}</span>
                  </li>
                }
              </ul>
            } @else { <app-empty icon="notifications_off" title="Sin novedades" text="Te avisaremos aquí cuando un estudiante solicite una evaluación en tus materias." /> }
          } @else { <div class="body"><app-skeleton-rows [rows]="3" [cols]="1" /></div> }
        </section>

        <section class="section" aria-labelledby="next-h">
          <header><span class="material-symbols-outlined hicon" aria-hidden="true">event</span><h2 id="next-h">Próximas evaluaciones</h2></header>
          @if (upcoming(); as u) {
            @if (u.length) {
              <ul class="next">
                @for (x of u; track x.id) {
                  <li><span class="date tnum">{{ schedule(x.scheduledAt) }}</span>
                    <span class="txt"><a class="strong" [routerLink]="['/docente/solicitudes', x.id]">{{ x.studentName }}</a><small>{{ x.subject }} · {{ courseLabel(x.course) }} {{ x.paralelo }}</small></span></li>
                }
              </ul>
            } @else { <p class="body muted">No tienes evaluaciones programadas.</p> }
          } @else { <div class="body"><app-skeleton-rows [rows]="2" [cols]="1" /></div> }
        </section>
      </div>
    </div>
  `,
  styleUrl: './teacher-pages.scss',
  styles: `
    .grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; align-items: start; }
    .side { display: grid; gap: 16px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .hicon { color: var(--on-surface-variant); font-size: 20px; }
    .hlink { font: var(--label-md); color: var(--primary-container); }
    .subjects, .news, .next { list-style: none; margin: 0; padding: 4px 0; }
    .subjects li + li, .news li + li, .next li + li { border-top: 1px solid var(--surface-container-high); }
    .subjects a { display: flex; align-items: center; gap: 12px; padding: 12px 18px; color: inherit; text-decoration: none; min-height: 60px; }
    .subjects a:hover { background: var(--surface-container-low); }
    .subjects a:focus-visible { outline: 2px solid var(--primary-container); outline-offset: -2px; }
    .sname { flex: 1; display: grid; gap: 2px; min-width: 0; }
    .sname small, .txt small { color: var(--on-surface-variant); font: var(--body-md); font-size: 0.8125rem; }
    .counts { display: flex; align-items: center; gap: 10px; font: var(--label-md); color: var(--on-surface); white-space: nowrap; }
    .counts .zero { color: var(--on-surface-variant); }
    .counts b { font-weight: 700; }
    .chev { color: var(--outline); }
    .news li, .next li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 18px; }
    .txt { flex: 1; display: grid; gap: 1px; min-width: 0; }
    .txt strong { font: var(--label-lg); }
    .news li.unread .txt strong::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--secondary-container);
      margin-right: 8px; vertical-align: 1px; }
    .ic { font-size: 20px; color: var(--primary-container); margin-top: 1px; }
    .ic.muted { color: var(--on-surface-variant); }
    .when { font: var(--label-sm); color: var(--on-surface-variant); white-space: nowrap; margin-top: 2px; }
    .date { min-width: 104px; font: var(--label-md); color: var(--primary-container); margin-top: 1px; }
    .muted { color: var(--on-surface-variant); margin: 0; }
    @media (max-width: 560px) { .counts .tag { display: none; } .subjects a { padding-inline: 14px; } }
  `,
})
export class TeacherHomePage {
  private readonly api = inject(TeacherApi);
  readonly order = TRACK_ORDER;
  readonly labels = TRACK_LABELS;
  readonly profile = signal<TeacherProfile | null>(null);
  readonly subjects = signal<TeacherSubject[] | null>(null);
  readonly items = signal<TeacherItem[] | null>(null);
  readonly news = signal<TeacherNotification[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly ago = fmtAgo;
  readonly icon = notificationIcon;
  readonly schedule = fmtSchedule;

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    const hi = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const first = this.profile()?.name.split(' ')[0];
    return first ? `${hi}, ${first}` : hi;
  });
  readonly counts = computed(() => {
    const it = this.items();
    if (!it) return null;
    const open = it.filter((i) => !CLOSED_REQUEST.has(i.requestStatus));
    return Object.fromEntries(TRACK_ORDER.map((t) => [t, open.filter((i) => i.track === t).length])) as Record<TrackStatus, number>;
  });
  readonly upcoming = computed(() => {
    const it = this.items();
    if (!it) return null;
    return it.filter((i) => i.track === 'programada' && i.scheduledAt && !CLOSED_REQUEST.has(i.requestStatus))
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')).slice(0, 4);
  });

  constructor() {
    Promise.all([this.api.profile(), this.api.subjects(), this.api.items(), this.api.notifications()]).then(
      ([p, s, i, n]) => { this.profile.set(p); this.subjects.set(s); this.items.set(i); this.news.set(n); },
      (e) => this.error.set(apiMessage(e, 'No pudimos cargar tu panel.')),
    );
  }

  courseLabel(c: string): string { return COURSE_LABELS_LONG[c] ?? c; }
}
