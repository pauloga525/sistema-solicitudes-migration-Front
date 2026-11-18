import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AnioLectivo, DateRange, Trimestre } from '../../../core/models/models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { apiMessage } from '../../../core/utils/errors';

type RangeGroup = FormGroup<{ name: FormControl<string>; startDate: FormControl<string>; endDate: FormControl<string> }>;
type TrimestreGroup = FormGroup<{ name: FormControl<string>; startDate: FormControl<string>; endDate: FormControl<string>; aportes: FormArray<RangeGroup> }>;

const toDateInput = (iso?: string) => (iso ? String(iso).slice(0, 10) : '');
const range = (r?: Partial<DateRange>): RangeGroup => new FormGroup({
  name: new FormControl(r?.name ?? '', { nonNullable: true }),
  startDate: new FormControl(toDateInput(r?.startDate), { nonNullable: true }),
  endDate: new FormControl(toDateInput(r?.endDate), { nonNullable: true }),
});
const trimestre = (t?: Partial<Trimestre>): TrimestreGroup => new FormGroup({
  name: new FormControl(t?.name ?? '', { nonNullable: true }),
  startDate: new FormControl(toDateInput(t?.startDate), { nonNullable: true }),
  endDate: new FormControl(toDateInput(t?.endDate), { nonNullable: true }),
  aportes: new FormArray((t?.aportes ?? []).map((a) => range(a))),
});

/** Tarjeta editable de un año lectivo con su árbol de trimestres y aportes. */
@Component({
  selector: 'app-anio-card',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anio-card.html',
  styleUrl: './anio-card.scss',
})
export class AnioCard {
  private readonly api = inject(AdminApiService);
  readonly anio = input.required<AnioLectivo>();
  readonly saved = output<AnioLectivo>();
  /** id borrado, o null para descartar un borrador nuevo. */
  readonly discarded = output<string | null>();

  readonly expanded = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  form!: FormGroup<{ name: FormControl<string>; startDate: FormControl<string>; endDate: FormControl<string>; trimestres: FormArray<TrimestreGroup> }>;
  private readonly confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>('confirm');

  get isNew(): boolean {
    return !this.anio()._id;
  }

  ngOnInit() {
    const a = this.anio();
    this.form = new FormGroup({
      name: new FormControl(a.name ?? '', { nonNullable: true }),
      startDate: new FormControl(toDateInput(a.startDate), { nonNullable: true }),
      endDate: new FormControl(toDateInput(a.endDate), { nonNullable: true }),
      trimestres: new FormArray((a.trimestres ?? []).map((t) => trimestre(t))),
    });
    this.expanded.set(this.isNew);
  }

  get trimestres() { return this.form.controls.trimestres; }
  aportes(i: number) { return this.trimestres.at(i).controls.aportes; }
  addTrimestre() { this.trimestres.push(trimestre()); }
  removeTrimestre(i: number) { this.trimestres.removeAt(i); }
  addAporte(i: number) { this.aportes(i).push(range()); }
  removeAporte(i: number, j: number) { this.aportes(i).removeAt(j); }

  async save() {
    this.saving.set(true);
    this.error.set(null);
    try {
      const payload = this.form.getRawValue() as AnioLectivo;
      const id = this.anio()._id;
      this.saved.emit(id ? await this.api.updateAnio(id, payload) : await this.api.createAnio(payload));
    } catch (err) {
      this.error.set(apiMessage(err, 'Error al guardar.'));
    } finally {
      this.saving.set(false);
    }
  }

  askDelete() { this.confirmDialog().nativeElement.showModal(); }
  closeConfirm() { this.confirmDialog().nativeElement.close(); }

  async remove() {
    this.closeConfirm();
    this.saving.set(true);
    try {
      await this.api.deleteAnio(this.anio()._id!);
      this.discarded.emit(this.anio()._id!);
    } catch (err) {
      this.error.set(apiMessage(err, 'Error al eliminar.'));
      this.saving.set(false);
    }
  }
}
