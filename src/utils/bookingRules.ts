export type AppointmentSlim = { date: string; time: string; status: string; program: string };

export function checkBookingConflict(
  existing: AppointmentSlim[],
  newDate: string,
  newProgram: string,
): { allowed: boolean; reason?: string } {
  const confirmed = existing.filter(a => a.date === newDate && a.status === 'confirmed');
  if (confirmed.length === 0) return { allowed: true };

  const isLymphException =
    newProgram === 'lymph' || confirmed.some(a => a.program === 'lymph');

  if (isLymphException) return { allowed: true };

  return {
    allowed: false,
    reason: 'Der Kunde hat an diesem Tag bereits einen Termin. Ausnahme gilt nur für Lymphdrainage.',
  };
}

export function checkSlotCapacity(
  allAppointments: AppointmentSlim[],
  date: string,
  time: string,
): { full: boolean; booked: number; free: number } {
  const booked = allAppointments.filter(
    a => a.date === date && a.time === time && a.status === 'confirmed',
  ).length;
  return { full: booked >= 2, booked, free: Math.max(0, 2 - booked) };
}

export function isSlotInPast(slotTime: string, todayStr: string, selectedDate: string): boolean {
  if (selectedDate !== todayStr) return false;
  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return slotTime <= nowStr;
}

export function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function germanHolidays(year: number): Set<string> {
  const e = easterDate(year);
  const add = (dt: Date, n: number) => {
    const r = new Date(dt);
    r.setDate(r.getDate() + n);
    return r;
  };
  const s = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return new Set([
    `${year}-01-01`,
    s(add(e, -2)),
    s(add(e, 1)),
    `${year}-05-01`,
    s(add(e, 39)),
    s(add(e, 50)),
    `${year}-10-03`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]);
}

export function isBookableDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (germanHolidays(d.getFullYear()).has(dateStr)) return false;
  return true;
}
