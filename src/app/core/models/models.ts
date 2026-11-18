export type RequestStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'en_revision' | 'cancelado';

export interface SolicitudRequest {
  _id: string;
  requestNumber: string;
  requestType: string;
  status: RequestStatus;
  representativeName: string;
  representativeDni: string;
  studentName: string;
  studentDni: string;
  course: string;
  paralelo: string;
  campus: string;
  payload: { subjects?: string[] } & Record<string, unknown>;
  pdfAccessToken?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RequestFilters {
  status?: string;
  course?: string;
  paralelo?: string;
  subject?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ConfigItem { name: string; active: number; }
export interface CourseSubjectGroup { key: string; course: string; specialty: string | null; subjects: ConfigItem[]; }
export interface SolicitudConfig { _id: string; requestType: string; courses: ConfigItem[]; subjects: ConfigItem[]; }

export interface DateRange { _id?: string; name: string; startDate: string; endDate: string; }
export interface Trimestre extends DateRange { aportes: DateRange[]; }
export interface AnioLectivo extends DateRange { trimestres: Trimestre[]; createdAt?: string; updatedAt?: string; }

export interface CupoInfo { limite: number; consumido: number; disponible: number; }

export interface ImportSummary { total: number; creados: number; actualizados: number; errores: { fila: number; motivo: string }[]; }

export interface CreateRequestPayload {
  requestType: 'proceso_mejora';
  representativeName: string;
  representativeDni: string;
  studentName: string;
  studentDni: string;
  course: string;
  paralelo: string;
  payload: { subjects: string[] };
}

export interface ProcesoMejoraFormData {
  representativeName: string;
  representativeDni: string;
  studentName: string;
  studentDni: string;
  course: string;
  paralelo: string;
  subjects: string[];
  termsAccepted: boolean;
}

/** Activación del sistema: fechas (hora de Ecuador, "AAAA-MM-DDTHH:MM") en que se pueden enviar solicitudes. */
export interface SubmissionWindow {
  configured: boolean; open: boolean; state: 'sin_fechas' | 'abierto' | 'proximo' | 'cerrado';
  start: string | null; end: string | null; message: string | null;
}
