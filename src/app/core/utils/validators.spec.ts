import { onlyLetters, toTitleCase, validateEcuadorianDni, validateFullName } from './validators';

describe('validadores (port de validators.ts)', () => {
  it('cédulas válidas e inválidas (módulo 10)', () => {
    for (const ok of ['0102030400', '0912345675', '1710034065']) expect(validateEcuadorianDni(ok)).toBe(true);
    for (const bad of ['0102030405', '123', '2502030400', '0062030400', 'abcdefghij', '01020304000']) expect(validateEcuadorianDni(bad)).toBe(false);
  });
  it('nombre completo exige 3 palabras de ≥2 letras', () => {
    expect(validateFullName('Juan Perez Lopez')).toBe(true);
    expect(validateFullName('Juan Perez')).toBe(false);
    expect(validateFullName('Juan P Lopez')).toBe(false);
  });
  it('solo letras y title case', () => {
    expect(onlyLetters('Ñandú 123 José!')).toBe('Ñandú  José');
    expect(toTitleCase('  maría   josé PÉREZ ')).toBe('María José Pérez');
  });
});
