import {
  checkBookingConflict,
  checkSlotCapacity,
  isSlotInPast,
  easterDate,
  germanHolidays,
  isBookableDay,
} from '../utils/bookingRules';

// ── Buchungskonflikt ─────────────────────────────────────────────────────────

describe('checkBookingConflict', () => {
  const confirmed = (program: string) => ({
    date: '2026-05-04',
    time: '09:00',
    status: 'confirmed',
    program,
  });

  test('erlaubt Buchung wenn kein Termin am Tag', () => {
    expect(checkBookingConflict([], '2026-05-04', 'muscle')).toEqual({ allowed: true });
  });

  test('blockiert zweiten normalen Termin am gleichen Tag', () => {
    const result = checkBookingConflict([confirmed('muscle')], '2026-05-04', 'relax');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('bereits einen Termin');
  });

  test('erlaubt Lymphdrainage zusätzlich zu normalem Termin', () => {
    const result = checkBookingConflict([confirmed('muscle')], '2026-05-04', 'lymph');
    expect(result.allowed).toBe(true);
  });

  test('erlaubt normalen Termin wenn bestehender Termin Lymphdrainage ist', () => {
    const result = checkBookingConflict([confirmed('lymph')], '2026-05-04', 'muscle');
    expect(result.allowed).toBe(true);
  });

  test('erlaubt zweite Lymphdrainage am gleichen Tag (Ausnahme gilt immer für lymph)', () => {
    // Die Geschäftsregel: lymph ist immer zusätzlich buchbar — auch zwei lymphs
    const result = checkBookingConflict([confirmed('lymph')], '2026-05-04', 'lymph');
    expect(result.allowed).toBe(true);
  });

  test('ignoriert stornierte Termine beim Konfliktcheck', () => {
    const cancelled = { ...confirmed('muscle'), status: 'cancelled' };
    const result = checkBookingConflict([cancelled], '2026-05-04', 'muscle');
    expect(result.allowed).toBe(true);
  });

  test('erlaubt Buchung an anderem Datum', () => {
    const result = checkBookingConflict([confirmed('muscle')], '2026-05-05', 'muscle');
    expect(result.allowed).toBe(true);
  });
});

// ── Slot-Kapazität ───────────────────────────────────────────────────────────

describe('checkSlotCapacity', () => {
  const appt = (time: string) => ({
    date: '2026-05-04',
    time,
    status: 'confirmed',
    program: 'muscle',
  });

  test('0 Buchungen → 2 Plätze frei', () => {
    expect(checkSlotCapacity([], '2026-05-04', '09:00')).toEqual({ full: false, booked: 0, free: 2 });
  });

  test('1 Buchung → 1 Platz frei', () => {
    expect(checkSlotCapacity([appt('09:00')], '2026-05-04', '09:00')).toEqual({ full: false, booked: 1, free: 1 });
  });

  test('2 Buchungen → ausgebucht', () => {
    expect(checkSlotCapacity([appt('09:00'), appt('09:00')], '2026-05-04', '09:00')).toEqual({ full: true, booked: 2, free: 0 });
  });

  test('andere Uhrzeiten zählen nicht', () => {
    expect(checkSlotCapacity([appt('09:30'), appt('09:30')], '2026-05-04', '09:00')).toEqual({ full: false, booked: 0, free: 2 });
  });

  test('stornierte Termine belegen keinen Platz', () => {
    const cancelled = { ...appt('09:00'), status: 'cancelled' };
    expect(checkSlotCapacity([cancelled, cancelled], '2026-05-04', '09:00')).toEqual({ full: false, booked: 0, free: 2 });
  });

  test('Kapazität nie unter 0', () => {
    const three = [appt('09:00'), appt('09:00'), appt('09:00')];
    const result = checkSlotCapacity(three, '2026-05-04', '09:00');
    expect(result.free).toBe(0);
  });
});

// ── Vergangene Zeitslots ─────────────────────────────────────────────────────

describe('isSlotInPast', () => {
  test('anderer Tag → nie vergangen', () => {
    expect(isSlotInPast('08:30', '2026-04-23', '2026-04-24')).toBe(false);
  });

  test('heutiger Tag, vergangener Slot → true', () => {
    // Mock: Test läuft um 12:00 Uhr → 08:30 ist vergangen
    const realDate = Date;
    const mockDate = new Date('2026-04-23T12:00:00');
    global.Date = class extends realDate {
      constructor(...args: any[]) { super(...args); }
      static now() { return mockDate.getTime(); }
    } as any;
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    expect(isSlotInPast('08:30', '2026-04-23', '2026-04-23')).toBe(true);

    jest.restoreAllMocks();
    global.Date = realDate;
  });

  test('heutiger Tag, zukünftiger Slot → false', () => {
    const realDate = Date;
    const mockDate = new Date('2026-04-23T08:00:00');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    expect(isSlotInPast('09:00', '2026-04-23', '2026-04-23')).toBe(false);

    jest.restoreAllMocks();
    global.Date = realDate;
  });
});

// ── Osterdatum ───────────────────────────────────────────────────────────────

describe('easterDate', () => {
  const cases: [number, string][] = [
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
  ];

  test.each(cases)('Ostern %i ist %s', (year, expected) => {
    const d = easterDate(year);
    const result = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});

// ── Deutsche Feiertage ───────────────────────────────────────────────────────

describe('germanHolidays', () => {
  test('enthält Neujahr, Tag der Deutschen Einheit, Weihnachten', () => {
    const h = germanHolidays(2026);
    expect(h.has('2026-01-01')).toBe(true);
    expect(h.has('2026-10-03')).toBe(true);
    expect(h.has('2026-12-25')).toBe(true);
    expect(h.has('2026-12-26')).toBe(true);
  });

  test('enthält Karfreitag und Ostermontag 2026', () => {
    const h = germanHolidays(2026);
    expect(h.has('2026-04-03')).toBe(true); // Karfreitag
    expect(h.has('2026-04-06')).toBe(true); // Ostermontag
  });

  test('enthält Pfingstmontag 2026', () => {
    const h = germanHolidays(2026);
    expect(h.has('2026-05-25')).toBe(true); // Pfingstmontag
  });

  test('enthält Tag der Arbeit', () => {
    expect(germanHolidays(2026).has('2026-05-01')).toBe(true);
  });

  test('enthält genau 9 Feiertage', () => {
    expect(germanHolidays(2026).size).toBe(9);
  });
});

// ── Buchbarer Tag ────────────────────────────────────────────────────────────

describe('isBookableDay', () => {
  test('normaler Werktag ist buchbar', () => {
    expect(isBookableDay('2026-05-04')).toBe(true); // Montag
  });

  test('Samstag ist nicht buchbar', () => {
    expect(isBookableDay('2026-05-02')).toBe(false);
  });

  test('Sonntag ist nicht buchbar', () => {
    expect(isBookableDay('2026-05-03')).toBe(false);
  });

  test('Feiertag ist nicht buchbar', () => {
    expect(isBookableDay('2026-01-01')).toBe(false);
    expect(isBookableDay('2026-12-25')).toBe(false);
    expect(isBookableDay('2026-04-06')).toBe(false); // Ostermontag
  });
});
