import { checkBookingConflict, checkSlotCapacity, isBookableDay } from '../utils/bookingRules';
import { validateIban } from '../utils/validation';

// Generiert N Kunden mit je M Terminen
function generateCustomers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `cust-${i}`,
    full_name: `Kunde ${i + 101}`,
    email: `kunde${i}@test.de`,
    customer_number: 101 + i,
  }));
}

function generateAppointments(customerCount: number, apptPerCustomer: number) {
  const appts = [];
  for (let c = 0; c < customerCount; c++) {
    for (let a = 0; a < apptPerCustomer; a++) {
      const day = (a % 28) + 1;
      appts.push({
        id: `appt-${c}-${a}`,
        user_id: `cust-${c}`,
        date: `2026-05-${String(day).padStart(2, '0')}`,
        time: a % 2 === 0 ? '09:00' : '16:00',
        status: 'confirmed' as const,
        program: 'muscle',
      });
    }
  }
  return appts;
}

// ── Last-Tests ───────────────────────────────────────────────────────────────

describe('Performance: 500 Kunden', () => {
  const customers = generateCustomers(500);
  const appointments = generateAppointments(500, 12);

  test('Kundensuche nach Name in < 20ms', () => {
    const start = performance.now();
    const query = 'Kunde 2';
    const result = customers.filter(c =>
      c.full_name.toLowerCase().includes(query.toLowerCase())
    );
    const elapsed = performance.now() - start;
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(20);
  });

  test('Terminfilter für einen Kunden in < 10ms', () => {
    const start = performance.now();
    const customerAppts = appointments.filter(a => a.user_id === 'cust-250');
    const elapsed = performance.now() - start;
    expect(customerAppts.length).toBe(12);
    expect(elapsed).toBeLessThan(10);
  });

  test('Slot-Kapazitätsprüfung über alle Termine in < 15ms', () => {
    const start = performance.now();
    const result = checkSlotCapacity(appointments, '2026-05-01', '09:00');
    const elapsed = performance.now() - start;
    expect(result.booked).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(15);
  });

  test('1000 Buchungskonflikte prüfen in < 50ms', () => {
    const customerAppts = appointments.filter(a => a.user_id === 'cust-0');
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      checkBookingConflict(customerAppts, '2026-05-01', 'muscle');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  test('500 Feiertags-/Wochendend-Checks in < 30ms', () => {
    const dates = Array.from({ length: 500 }, (_, i) => {
      const d = new Date(2026, 0, i + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const start = performance.now();
    dates.forEach(d => isBookableDay(d));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(30);
  });
});

// ── Grenzwert-Tests ──────────────────────────────────────────────────────────

describe('Grenzwerte', () => {
  test('1000 Kunden gleichzeitig filtern', () => {
    const big = generateCustomers(1000); // Nummern 101–1100
    const start = performance.now();
    // customer_number > 1000 → Nummern 1001–1100 = 100 Treffer
    const found = big.filter(c => c.customer_number > 1000);
    const elapsed = performance.now() - start;
    expect(found).toHaveLength(100);
    expect(elapsed).toBeLessThan(10);
  });

  test('100 IBAN-Validierungen in < 20ms', () => {
    const ibans = [
      'DE89370400440532013000',
      'AT611904300234573201',
      'DE00000000000000000000', // ungültig
    ];
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      ibans.forEach(iban => validateIban(iban));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  test('Slot voll nach genau 2 Buchungen', () => {
    const full = generateAppointments(2, 1).map(a => ({
      ...a,
      date: '2026-05-04',
      time: '09:00',
    }));
    expect(checkSlotCapacity(full, '2026-05-04', '09:00').full).toBe(true);
  });

  test('Slot nicht voll nach 1 Buchung', () => {
    const one = generateAppointments(1, 1).map(a => ({
      ...a,
      date: '2026-05-04',
      time: '09:00',
    }));
    expect(checkSlotCapacity(one, '2026-05-04', '09:00').full).toBe(false);
  });

  test('Lymph-Ausnahme funktioniert bei 100 gleichzeitigen Checks', () => {
    const existing = [{ date: '2026-05-04', time: '09:00', status: 'confirmed', program: 'muscle' }];
    for (let i = 0; i < 100; i++) {
      expect(checkBookingConflict(existing, '2026-05-04', 'lymph').allowed).toBe(true);
      expect(checkBookingConflict(existing, '2026-05-04', 'relax').allowed).toBe(false);
    }
  });
});
