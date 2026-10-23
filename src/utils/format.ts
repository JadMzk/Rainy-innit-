import { hourLabelFromIso, parseUtcMs, utcToLocalParts } from '../engine/clock';

export function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatMm(mm: number): string {
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function formatUpdated(iso: string, utcOffsetSeconds: number, nowIso: string): string {
  const ageMin = Math.round((parseUtcMs(nowIso) - parseUtcMs(iso)) / 60_000);
  if (ageMin < 1) return 'Updated just now';
  if (ageMin < 60) return `Updated ${ageMin} min ago`;
  return `Updated ${hourLabelFromIso(iso, utcOffsetSeconds)}`;
}

export function formatClock(iso: string, utcOffsetSeconds: number): string {
  const local = utcToLocalParts(iso, utcOffsetSeconds);
  return `${local.date} ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}
