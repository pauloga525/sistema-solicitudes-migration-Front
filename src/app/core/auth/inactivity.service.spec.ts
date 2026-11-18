import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { INACTIVITY_MS, InactivityService } from './inactivity.service';
import { SessionService } from './session.service';

describe('InactivityService (timeout de 5 minutos)', () => {
  afterEach(() => vi.useRealTimers());

  it('cierra la sesión tras 5 min sin actividad y la actividad reinicia el contador', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const session = TestBed.inject(SessionService);
    const spy = vi.spyOn(session, 'forceLogout').mockImplementation(() => {});
    const svc = TestBed.inject(InactivityService);
    svc.start();
    vi.advanceTimersByTime(INACTIVITY_MS - 1000);
    document.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(INACTIVITY_MS - 1000);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(spy).toHaveBeenCalledTimes(1);
    svc.stop();
    expect(INACTIVITY_MS).toBe(300000);
  });
});
