import type { DateHorizon } from "./config.js";
import type { DateWindow } from "./models.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addMonths(value: Date, months: number): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function generateDateWindows(today: Date, horizon: DateHorizon, stayLengths: number[]): DateWindow[] {
  const start = addMonths(today, horizon.startMonthsFromNow);
  const end = addMonths(today, horizon.endMonthsFromNow);
  const windows: DateWindow[] = [];
  let current = start;
  while (current.getTime() <= end.getTime()) {
    for (const nights of stayLengths) {
      const checkOut = addDays(current, nights);
      const checkInLabel = dateOnly(current);
      const checkOutLabel = dateOnly(checkOut);
      windows.push({
        checkIn: checkInLabel,
        checkOut: checkOutLabel,
        nights,
        label: `${checkInLabel} to ${checkOutLabel}`
      });
    }
    current = addDays(current, horizon.stepDays);
  }
  return windows;
}

function daysInMonth(year: number, zeroBasedMonth: number): number {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
}
