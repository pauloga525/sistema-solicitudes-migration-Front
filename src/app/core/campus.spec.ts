import { campusGroupForCourse } from './catalogs';

describe('campus por curso', () => {
  it('1ro de Básica a 7mo → Carlos Crespi / María Auxiliadora', () => {
    for (const c of ['1ro_Basica', '4to_Basica', '5to', '7mo']) expect(campusGroupForCourse(c)).toBe('CC_MA');
  });
  it('8vo a 3ro de Bachillerato → Yanuncay', () => {
    for (const c of ['8vo', '10mo', '1ro_Bach', '3ro_Bach']) expect(campusGroupForCourse(c)).toBe('YANUNCAY');
  });
});
