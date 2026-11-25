import { DemoTeacherApi } from './teacher-api';
import { CLOSED_REQUEST } from './teacher.models';
import { fmtSchedule } from './pages/teacher-format';

describe('panel docente (datos de ejemplo)', () => {
  it('filtra por seguimiento y por materia', async () => {
    const api = new DemoTeacherApi();
    const all = await api.items();
    const subjects = await api.subjects();
    const s = subjects[0];
    const mine = await api.items({ subjectKey: s.key });
    expect(mine.every((i) => `${i.course}|${i.paralelo}|${i.subject}` === s.key)).toBe(true);
    const pending = await api.items({ track: 'por_atender' });
    expect(pending.every((i) => i.track === 'por_atender' && !CLOSED_REQUEST.has(i.requestStatus))).toBe(true);
    expect(all.length).toBeGreaterThan(pending.length);
  });

  it('no cambia el seguimiento de solicitudes canceladas o rechazadas', async () => {
    const api = new DemoTeacherApi();
    const all = await api.items();
    const closed = all.find((i) => CLOSED_REQUEST.has(i.requestStatus))!;
    const open = all.find((i) => !CLOSED_REQUEST.has(i.requestStatus) && i.track === 'por_atender')!;
    const out = await api.updateTrack([closed.id, open.id], { track: 'programada', scheduledAt: '2026-12-01T09:00' });
    expect(out.find((i) => i.id === closed.id)!.track).toBe('por_atender');
    expect(out.find((i) => i.id === open.id)!.scheduledAt).toBe('2026-12-01T09:00');
  });

  it('marca notificaciones como leídas y actualiza el contador', async () => {
    const api = new DemoTeacherApi();
    expect(api.unread()).toBeGreaterThan(0);
    await api.markRead('all');
    expect(api.unread()).toBe(0);
  });

  it('formatea la fecha programada', () => {
    expect(fmtSchedule('2026-11-25T08:00')).toBe('mié 25 nov, 08:00');
    expect(fmtSchedule(null)).toBe('—');
  });
});
