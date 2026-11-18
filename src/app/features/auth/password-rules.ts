export const MIN_PASSWORD = 10;

/** Reglas visibles mientras se escribe (las mismas que valida el servidor). */
export function passwordRules(pw: string, confirm: string, email?: string | null) {
  return [
    { text: `Al menos ${MIN_PASSWORD} caracteres`, ok: pw.trim().length >= MIN_PASSWORD },
    { text: 'Distinta de tu correo', ok: !!pw && (!email || pw.trim().toLowerCase() !== email.toLowerCase()) },
    { text: 'Las dos contraseñas coinciden', ok: !!pw && pw === confirm },
  ];
}
