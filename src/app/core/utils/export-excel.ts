import { COURSE_LABELS_SHORT, ESTADO_LABELS } from '../catalogs';
import { RequestFilters, SolicitudRequest } from '../models/models';
import { downloadBlob } from './pdf';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const EXCEL_HEADERS = [
  'N° Solicitud', 'Estudiante', 'Curso', 'Paralelo', 'Campus', 'Representante', 'CI Representante',
  'Materias Solicitadas', 'Estado', 'Fecha de Solicitud',
] as const;
const WIDTHS = [18, 30, 14, 10, 22, 30, 16, 50, 14, 18];

/** Filas del Excel (mismas columnas y formato que exportExcel.js del original). */
export function buildExcelRows(solicitudes: SolicitudRequest[], filters: RequestFilters): string[][] {
  const subject = filters.subject || '';
  return solicitudes.map((s) => [
    s.requestNumber ?? s._id?.slice(-6),
    s.studentName,
    COURSE_LABELS_SHORT[s.course] ?? s.course?.replace(/_/g, ' ') ?? '—',
    s.paralelo ?? '—',
    s.campus?.replace(/_/g, ' ') ?? '—',
    s.representativeName,
    s.representativeDni,
    subject ? subject : (s.payload?.subjects ?? []).join(', '),
    ESTADO_LABELS[s.status] ?? s.status,
    formatDate(s.createdAt),
  ]);
}

export function excelFileName(filters: RequestFilters, today = new Date()): string {
  const parts = ['solicitudes'];
  if (filters.subject) parts.push(filters.subject.replace(/\s+/g, '_'));
  if (filters.course) parts.push(filters.course.replace(/\s+/g, '_'));
  if (filters.paralelo) parts.push(`paralelo_${filters.paralelo}`);
  parts.push(today.toISOString().slice(0, 10));
  return `${parts.join('-')}.xlsx`;
}

/** Genera y descarga el .xlsx. exceljs se carga bajo demanda (no pesa en el bundle inicial). */
export async function exportSolicitudesToExcel(solicitudes: SolicitudRequest[], filters: RequestFilters): Promise<void> {
  if (solicitudes.length === 0) return;
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  const ws = wb.addWorksheet(filters.subject ? filters.subject.slice(0, 31) : 'Solicitudes');
  ws.addRow([...EXCEL_HEADERS]);
  buildExcelRows(solicitudes, filters).forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => (col.width = WIDTHS[i]));
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), excelFileName(filters));
}
