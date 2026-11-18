import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Filtra todo excepto letras (incluye acentos/ñ) y espacios. */
export function onlyLetters(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
}

/** Normaliza a "Cada Palabra Con Mayúscula Inicial". */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Exige al menos un nombre y dos apellidos (≥3 palabras de ≥2 caracteres). */
export function validateFullName(value: string): boolean {
  return value.trim().split(/\s+/).filter((w) => w.length >= 2).length >= 3;
}

/** Algoritmo módulo 10 del Registro Civil ecuatoriano. */
export function validateEcuadorianDni(dni: string): boolean {
  if (!/^\d{10}$/.test(dni)) return false;
  const province = parseInt(dni.substring(0, 2), 10);
  if (province < 1 || province > 24) return false;
  if (parseInt(dni[2], 10) >= 6) return false;
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(dni[i], 10) * coefficients[i];
    if (val >= 10) val -= 9;
    sum += val;
  }
  const check = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return check === parseInt(dni[9], 10);
}

export const fullNameValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  validateFullName(String(c.value ?? '')) ? null : { fullName: true };

export const ecuadorianDniValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  validateEcuadorianDni(String(c.value ?? '')) ? null : { dni: true };

export const nonEmptyArrayValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  Array.isArray(c.value) && c.value.length > 0 ? null : { required: true };
