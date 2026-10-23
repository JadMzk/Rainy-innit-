const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function parseUtcMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Unparseable timestamp: ${iso}`);
  }
  return ms;
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(parseUtcMs(iso) + minutes * MINUTE_MS).toISOString();
}

export function addHours(iso: string, hours: number): string {
  return addMinutes(iso, hours * 60);
}

export interface LocalParts {
  date: string;
  hour: number;
  minute: number;
  minutesOfDay: number;
}

/** Shift a UTC instant into the location's wall clock, then read the parts. */
export function utcToLocalParts(iso: string, utcOffsetSeconds: number): LocalParts {
  const shifted = new Date(parseUtcMs(iso) + utcOffsetSeconds * 1000);
  const date = shifted.toISOString().slice(0, 10);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return { date, hour, minute, minutesOfDay: hour * 60 + minute };
}

export function formatHhmm(minutesOfDay: number): string {
  const span = 24 * 60;
  const wrapped = ((Math.trunc(minutesOfDay) % span) + span) % span;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseHhmm(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Expected HH:MM, received "${value}"`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Clock time out of range: ${value}`);
  }
  return hour * 60 + minute;
}

/**
 * Quiet hours are half-open: [start, end).
 * When start is after end, the window wraps midnight (22:00–07:00).
 * Equal endpoints mean quiet hours are off.
 */
export function isQuietHour(minutesOfDay: number, startHhmm: string, endHhmm: string): boolean {
  const start = parseHhmm(startHhmm);
  const end = parseHhmm(endHhmm);
  if (start === end) return false;
  if (start < end) return minutesOfDay >= start && minutesOfDay < end;
  return minutesOfDay >= start || minutesOfDay < end;
}

export function wallClockToUtcIso(date: string, hhmm: string, utcOffsetSeconds: number): string {
  const minutes = parseHhmm(hhmm);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const localAsUtc = Date.parse(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
  );
  return new Date(localAsUtc - utcOffsetSeconds * 1000).toISOString();
}

export function addDaysToDate(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export function nextDepartureUtcIso(
  nowIso: string,
  hhmm: string,
  utcOffsetSeconds: number,
): string {
  const local = utcToLocalParts(nowIso, utcOffsetSeconds);
  let departure = wallClockToUtcIso(local.date, hhmm, utcOffsetSeconds);
  if (parseUtcMs(departure) <= parseUtcMs(nowIso)) {
    departure = wallClockToUtcIso(addDaysToDate(local.date, 1), hhmm, utcOffsetSeconds);
  }
  return departure;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayShort(date: string): string {
  const ms = Date.parse(`${date}T12:00:00.000Z`);
  const index = new Date(ms).getUTCDay();
  return WEEKDAYS[index] ?? 'Day';
}

export function dayLabelFor(dateIso: string, todayLocalDate: string): string {
  if (dateIso === todayLocalDate) return 'Today';
  if (dateIso === addDaysToDate(todayLocalDate, 1)) return 'Tomorrow';
  return weekdayShort(dateIso);
}

export function hourLabelFromIso(iso: string, utcOffsetSeconds: number): string {
  return formatHhmm(utcToLocalParts(iso, utcOffsetSeconds).minutesOfDay);
}

/**
 * Rain-event signature: local date plus a bucket the width of the
 * deduplication window. 240 minutes → 4-hour buckets.
 */
export function rainEventSignature(
  startIso: string,
  utcOffsetSeconds: number,
  deduplicationWindowMinutes: number,
): string {
  const local = utcToLocalParts(startIso, utcOffsetSeconds);
  const bucketHours = Math.max(1, Math.round(deduplicationWindowMinutes / 60));
  const bucket = Math.floor(local.hour / bucketHours);
  return `${local.date}|rain-${bucket}`;
}

export function sameLocalDay(aIso: string, bIso: string, utcOffsetSeconds: number): boolean {
  return utcToLocalParts(aIso, utcOffsetSeconds).date === utcToLocalParts(bIso, utcOffsetSeconds).date;
}
