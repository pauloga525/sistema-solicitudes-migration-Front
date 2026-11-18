import { getAcciones } from './solicitudes-page';

describe('acciones por fila', () => {
  it('proceso_mejora solo ver e imprimir', () => expect(getAcciones('en_revision', 'proceso_mejora')).toEqual(['ver', 'imprimir']));
  it('otros tipos pendientes permiten aprobar/negar', () => expect(getAcciones('pendiente', 'otro')).toEqual(['ver', 'aprobar', 'negar']));
  it('rechazado solo ver', () => expect(getAcciones('rechazado', 'otro')).toEqual(['ver']));
});
