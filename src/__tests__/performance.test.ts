import { checkDailyConflict, isBookableDay } from '../utils/bookingRules';

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
        program: 'individual',
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

  test('1000 Buchungskonflikte prüfen in < 50ms', () => {
    const customerAppts = appointments.filter(a => a.user_id === 'cust-0');
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      checkDailyConflict(customerAppts, '2026-05-01');
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
    const big = generateCustomers(1000);
    const start = performance.now();
    const found = big.filter(c => c.customer_number > 1000);
    const elapsed = performance.now() - start;
    expect(found).toHaveLength(100);
    expect(elapsed).toBeLessThan(10);
  });

  test('Tageskonflikt korrekt erkannt nach 1 Termin', () => {
    const existing = [{ date: '2026-05-04', time: '09:00', status: 'confirmed', program: 'individual' }];
    expect(checkDailyConflict(existing, '2026-05-04').allowed).toBe(false);
    expect(checkDailyConflict(existing, '2026-05-05').allowed).toBe(true);
  });
});
