/**
 * Catálogos del frontend (fuente única, port de src/config/catalogs.ts).
 * El backend sigue siendo la fuente de verdad; esto evita copias sueltas.
 */
/**
 * Paralelos por curso (mismo catálogo que el backend, `app/modules/catalog.py`):
 * 1ro de Básica A–I · 2do a 7mo de Básica A–G · 8vo a 10mo A–J ·
 * Bachillerato: según la especialidad (el código del paralelo identifica la especialidad).
 */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export const SPECIALTIES: Record<string, readonly string[]> = {
  'Desarrollo de Software': ['E1', 'E2'],
  'Mecatrónica': ['D1', 'D2'],
  'Mecánica Industrial': ['B'],
  'Electromecánica Automotriz': ['C1', 'C2'],
  'Ciencias': ['F1', 'F2', 'F3'],
  'Instalaciones Eléctricas y Automatización': ['A1', 'A2'],
};
export const SPECIALTY_NAMES = Object.keys(SPECIALTIES);
export const BACH_COURSES = ['1ro_Bach', '2do_Bach', '3ro_Bach'];
export const isBach = (course: string) => BACH_COURSES.includes(course);

export function paralelosFor(course: string, specialty?: string | null): readonly string[] {
  if (course === '1ro_Basica') return LETTERS.slice(0, 9);
  if (['8vo', '9no', '10mo'].includes(course)) return LETTERS;
  if (isBach(course)) return SPECIALTIES[specialty ?? ''] ?? [];
  if (!course) return [];
  return LETTERS.slice(0, 7);
}

export function specialtyForParalelo(paralelo: string): string | null {
  return SPECIALTY_NAMES.find((n) => SPECIALTIES[n].includes(paralelo)) ?? null;
}

/** Todos los valores posibles (filtros del panel). */
export const PARALELOS: readonly string[] = [...LETTERS, ...Object.values(SPECIALTIES).flat().filter((c) => !(LETTERS as readonly string[]).includes(c))];

export const SUBJECTS_PERMITIDOS = [
  'Matemática',
  'Lengua y literatura',
  'Science',
  'Estudios Sociales',
  'Inglés',
  'ECA',
  'Computación',
  'Animación a la lectura',
  'Educación física',
  'ERE',
  'Razonamiento lógico Matemático',
  'Acompañamiento integral en el Aula',
] as const;

export const COURSE_CODES = [
  '1ro_Basica', '2do_Basica', '3ro_Basica', '4to_Basica', '5to', '6to', '7mo',
  '8vo', '9no', '10mo', '1ro_Bach', '2do_Bach', '3ro_Bach',
] as const;

/** Forma larga ("4to de Básica") — formulario público y editor admin. */
export const COURSE_LABELS_LONG: Record<string, string> = {
  '1ro_Basica': '1ro de Básica', '2do_Basica': '2do de Básica', '3ro_Basica': '3ro de Básica',
  '4to_Basica': '4to de Básica', '5to': '5to de Básica', '6to': '6to de Básica', '7mo': '7mo de Básica',
  '8vo': '8vo de Básica', '9no': '9no de Básica', '10mo': '10mo de Básica',
  '1ro_Bach': '1ro de Bachillerato', '2do_Bach': '2do de Bachillerato', '3ro_Bach': '3ro de Bachillerato',
};

/** Forma corta ("4to Básica") — tabla de solicitudes y exportación a Excel. */
export const COURSE_LABELS_SHORT: Record<string, string> = {
  '1ro_Basica': '1ro Básica', '2do_Basica': '2do Básica', '3ro_Basica': '3ro Básica', '4to_Basica': '4to Básica',
  '5to': '5to', '6to': '6to', '7mo': '7mo', '8vo': '8vo', '9no': '9no', '10mo': '10mo',
  '1ro_Bach': '1ro Bach', '2do_Bach': '2do Bach', '3ro_Bach': '3ro Bach',
};

export const REQUEST_STATUS = {
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  EN_REVISION: 'en_revision',
  CANCELADO: 'cancelado',
} as const;

export const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', en_revision: 'En Revisión', cancelado: 'Cancelado',
};

/** Nombre del campus a partir del curso (solo informativo; el backend lo calcula de forma autoritativa). */
export function campusForCourse(course: string): string {
  if (!course) return '';
  if (['1ro_Basica', '2do_Basica', '3ro_Basica', '4to_Basica'].includes(course)) return 'Carlos Crespi';
  if (['5to', '6to', '7mo'].includes(course)) return 'María Auxiliadora';
  return 'Yanuncay';
}

export const humanize = (v?: string | null): string => (v ? v.replace(/_/g, ' ') : '—');

/** Grupo de campus del trámite según el curso: 1ro de Básica a 7mo → Carlos Crespi / María Auxiliadora; 8vo a 3ro de Bachillerato → Yanuncay. */
export type CampusGroup = 'CC_MA' | 'YANUNCAY';
const CC_MA_COURSES = new Set(['1ro_Basica', '2do_Basica', '3ro_Basica', '4to_Basica', '5to', '6to', '7mo']);
export function campusGroupForCourse(course: string): CampusGroup {
  return CC_MA_COURSES.has(course) ? 'CC_MA' : 'YANUNCAY';
}
