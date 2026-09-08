import { describe, expect, it } from 'vitest';

import {
  endOfBrasiliaCivilDayIso,
  isCivilDate,
  startOfBrasiliaCivilDayIso,
  validateCivilDateRange,
} from './date-range';

describe('web/dateRange', () => {
  it('reconhece somente datas civis YYYY-MM-DD válidas', () => {
    expect(isCivilDate('2026-09-06')).toBe(true);
    expect(isCivilDate('2026-02-29')).toBe(false);
    expect(isCivilDate('2024-02-29')).toBe(true);
    expect(isCivilDate('06/09/2026')).toBe(false);
    expect(isCivilDate('2026-9-6')).toBe(false);
  });

  it('inclui o dia inteiro em Brasília sem depender do dispositivo', () => {
    expect(startOfBrasiliaCivilDayIso('2026-09-06')).toBe('2026-09-06T03:00:00.000Z');
    expect(endOfBrasiliaCivilDayIso('2026-09-06')).toBe('2026-09-07T02:59:59.999Z');
  });

  it('resolve limites em torno de uma transição histórica de horário de verão', () => {
    expect(startOfBrasiliaCivilDayIso('2018-11-04')).toBe('2018-11-04T03:00:00.000Z');
    expect(endOfBrasiliaCivilDayIso('2018-11-04')).toBe('2018-11-05T01:59:59.999Z');
    const startFeb17 = startOfBrasiliaCivilDayIso('2019-02-17');
    const endFeb17 = endOfBrasiliaCivilDayIso('2019-02-17');
    expect(new Date(startFeb17).getTime()).toBeLessThan(new Date(endFeb17).getTime());
    expect(endFeb17).toBe('2019-02-18T02:59:59.999Z');
  });

  it('rejeita intervalo invertido antes de qualquer consulta', () => {
    expect(validateCivilDateRange({ from: '2026-09-10', to: '2026-09-05' })).toEqual({
      ok: false,
      reason: 'inverted-range',
    });
    expect(validateCivilDateRange({ from: '2026-09-05', to: '2026-09-10' })).toEqual({ ok: true });
    expect(validateCivilDateRange({ from: '2026-09-05' })).toEqual({ ok: true });
    expect(validateCivilDateRange({ to: '2026-09-05' })).toEqual({ ok: true });
  });

  it('sinaliza datas malformadas antes de tentar interpretar o fuso', () => {
    expect(validateCivilDateRange({ from: '06/09/2026' })).toEqual({
      ok: false,
      reason: 'invalid-from',
    });
    expect(validateCivilDateRange({ to: '2026-13-01' })).toEqual({
      ok: false,
      reason: 'invalid-to',
    });
  });
});
