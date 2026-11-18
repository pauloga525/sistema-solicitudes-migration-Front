import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { COURSE_LABELS_LONG, PARALELOS } from '../../../core/catalogs';
import { apiMessage } from '../../../core/utils/errors';
import { fmtAgo } from '../../../shared/ui/format';
import { Pager } from '../../../shared/ui/pager';
import { EmptyState, SkeletonRows } from '../../../shared/ui/states';
import { Dict, Page, SaApi } from '../sa-api.service';

@Component({
  selector: 'app-sa-students',
  imports: [FormsModule, Pager, EmptyState, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Estudiantes</h1><p class="lede">Cuentas de estudiantes con sus datos (descifrados solo para ti; cada consulta queda auditada).</p></div>
    </div>
    <form class="filters" (submit)="$event.preventDefault(); search()" role="search">
      <label class="field grow"><span class="field-label">Buscar</span>
        <input class="input" type="search" name="q" [(ngModel)]="f.q" placeholder="Nombre, correo o cédula exacta" /></label>
      <label class="field"><span class="field-label">Curso</span>
        <select class="select" name="course" [(ngModel)]="f.course" (ngModelChange)="search()"><option value="">Todos</option>
          @for (c of courses; track c[0]) { <option [value]="c[0]">{{ c[1] }}</option> }</select></label>
      <label class="field"><span class="field-label">Paralelo</span>
        <select class="select" name="paralelo" [(ngModel)]="f.paralelo" (ngModelChange)="search()"><option value="">Todos</option>
          @for (p of paralelos; track p) { <option [value]="p">{{ p }}</option> }</select></label>
      <label class="field"><span class="field-label">Datos</span>
        <select class="select" name="profile" [(ngModel)]="f.profile" (ngModelChange)="search()"><option value="">Todos</option>
          <option value="complete">Completos</option><option value="incomplete">Incompletos</option></select></label>
      <label class="field"><span class="field-label">Padrón</span>
        <select class="select" name="padron" [(ngModel)]="f.padron" (ngModelChange)="search()"><option value="">Todos</option>
          <option value="yes">En el padrón</option><option value="no">No encontrado</option></select></label>
      <button type="submit" class="btn btn-outline">Buscar</button>
    </form>
    <div class="table-wrap">
      @if (error()) { <p class="alert alert-error" role="alert" style="margin:12px">{{ error() }}</p> }
      @if (loading() && !page()) { <app-skeleton-rows [cols]="6" /> }
      @else if (page()?.rows?.length) {
        <div class="table-scroll">
          <table class="dtable">
            <thead><tr><th>Estudiante</th><th>Curso</th><th>Datos</th><th class="num">Repr.</th><th class="num">Solicitudes</th><th>Último ingreso</th></tr></thead>
            <tbody>
              @for (s of page()!.rows; track s['id']) {
                <tr class="clickable" tabindex="0" (click)="open(s)" (keydown.enter)="open(s)">
                  <td><span class="strong">{{ s['name'] || '(sin datos)' }}</span><span class="sub">{{ s['email'] }}</span></td>
                  <td>{{ s['course'] ? courseLabel(s['course']) + ' ' + s['paralelo'] : '—' }}</td>
                  <td>
                    @if (s['profileCompleted']) { <span class="tag ok">Completos</span> } @else { <span class="tag warn">Incompletos</span> }
                    @if (!s['padronMatch'] && s['course']) { <span class="tag" title="La cédula no aparece en el padrón importado">Fuera del padrón</span> }
                    @if (!s['isActive']) { <span class="tag bad">Desactivado</span> }
                  </td>
                  <td class="num" [class.bad-n]="!s['representatives']">{{ s['representatives'] }}</td>
                  <td class="num">{{ s['requests'] }}</td>
                  <td class="muted">{{ s['lastLoginAt'] ? ago($any(s['lastLoginAt'])) : 'Nunca' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [page]="page()!.page" [pageSize]="page()!.pageSize" [total]="page()!.total" [totalPages]="page()!.totalPages" (go)="go($event)" />
      } @else if (!loading()) {
        <app-empty icon="school" title="No hay estudiantes con esos filtros" text="Los estudiantes aparecen aquí cuando crean su cuenta con el correo institucional." />
      }
    </div>
  `,
  styles: `.bad-n { color: var(--error); font-weight: 650; }`,
})
export class StudentsPage {
  private readonly api = inject(SaApi);
  private readonly router = inject(Router);
  readonly courses = Object.entries(COURSE_LABELS_LONG);
  readonly paralelos = PARALELOS;
  readonly ago = fmtAgo;
  f = { q: '', course: '', paralelo: '', profile: '', padron: '' };
  readonly pageNo = signal(1);
  readonly page = signal<Page<Dict> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() { void this.load(); }
  courseLabel(c: unknown) { return (COURSE_LABELS_LONG as Record<string, string>)[String(c)] ?? String(c); }
  search() { this.pageNo.set(1); void this.load(); }
  go(p: number) { this.pageNo.set(p); void this.load(); }
  open(s: Dict) { void this.router.navigate(['/superadmin/estudiantes', s['id']]); }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try { this.page.set(await this.api.students({ ...this.f, q: this.f.q.trim(), page: this.pageNo() })); }
    catch (e) { this.error.set(apiMessage(e, 'No pudimos cargar los estudiantes.')); }
    finally { this.loading.set(false); }
  }
}
