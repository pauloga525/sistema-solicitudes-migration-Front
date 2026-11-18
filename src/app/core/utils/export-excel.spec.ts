import { SolicitudRequest } from '../models/models';
import { EXCEL_HEADERS, buildExcelRows, excelFileName } from './export-excel';

const req = (over: Partial<SolicitudRequest> = {}): SolicitudRequest => ({
  _id: '6af493c2b0b3163e8ebf91ad', requestNumber: 'PM-2026-0001', requestType: 'proceso_mejora', status: 'en_revision',
  representativeName: 'Juan Perez Lopez', representativeDni: '0102030400', studentName: 'Ana Mora Paz', studentDni: '0912345675',
  course: '4to_Basica', paralelo: 'A', campus: 'Carlos_Crespi', payload: { subjects: ['Matemática', 'Inglés'] },
  createdAt: '2026-11-11T16:00:00.000Z', updatedAt: '2026-11-11T16:00:00.000Z', ...over,
});

describe('exportación a Excel', () => {
  it('mismas columnas que el original', () => {
    expect(EXCEL_HEADERS.length).toBe(10);
    expect(EXCEL_HEADERS[7]).toBe('Materias Solicitadas');
  });
  it('filas con etiquetas cortas y la materia filtrada', () => {
    const [row] = buildExcelRows([req()], { subject: 'Inglés' });
    expect(row.slice(0, 5)).toEqual(['PM-2026-0001', 'Ana Mora Paz', '4to Básica', 'A', 'Carlos Crespi']);
    expect(row[7]).toBe('Inglés');
    expect(row[8]).toBe('En Revisión');
    expect(buildExcelRows([req()], {})[0][7]).toBe('Matemática, Inglés');
  });
  it('nombre de archivo', () => {
    expect(excelFileName({ subject: 'Lengua y literatura', course: '5to', paralelo: 'B' }, new Date('2026-11-11T12:00:00Z')))
      .toBe('solicitudes-Lengua_y_literatura-5to-paralelo_B-2026-11-11.xlsx');
  });
});
