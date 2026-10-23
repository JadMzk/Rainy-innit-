import { isQuietHour, rainEventSignature } from '../src/engine/clock';

describe('clock', () => {
  test('quiet hours wrap midnight and are half-open at the end', () => {
    expect(isQuietHour(22 * 60, '22:00', '07:00')).toBe(true);
    expect(isQuietHour(23 * 60 + 30, '22:00', '07:00')).toBe(true);
    expect(isQuietHour(2 * 60, '22:00', '07:00')).toBe(true);
    expect(isQuietHour(7 * 60, '22:00', '07:00')).toBe(false);
    expect(isQuietHour(12 * 60, '22:00', '07:00')).toBe(false);
    expect(isQuietHour(21 * 60 + 59, '22:00', '07:00')).toBe(false);
  });

  test('equal quiet-hour endpoints mean quiet hours are off', () => {
    expect(isQuietHour(3 * 60, '00:00', '00:00')).toBe(false);
  });

  test('rain signatures bucket the local hour by the dedupe window', () => {
    expect(rainEventSignature('2026-10-23T15:10:00.000Z', 0, 240)).toBe('2026-10-23|rain-3');
    expect(rainEventSignature('2026-10-23T15:10:00.000Z', 3600, 240)).toBe('2026-10-23|rain-4');
  });
});
