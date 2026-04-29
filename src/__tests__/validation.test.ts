import { validateIban, validateBic } from '../utils/validation';

// ── IBAN Validierung ─────────────────────────────────────────────────────────

describe('validateIban', () => {
  test('gültige deutsche IBAN ohne Leerzeichen', () => {
    expect(validateIban('DE89370400440532013000')).toBeNull();
  });

  test('gültige deutsche IBAN mit Leerzeichen', () => {
    expect(validateIban('DE89 3704 0044 0532 0130 00')).toBeNull();
  });

  test('gültige österreichische IBAN', () => {
    expect(validateIban('AT611904300234573201')).toBeNull();
  });

  test('zu kurze IBAN', () => {
    expect(validateIban('DE89')).not.toBeNull();
  });

  test('ungültige Prüfsumme', () => {
    expect(validateIban('DE00370400440532013000')).not.toBeNull();
  });

  test('leere Eingabe', () => {
    expect(validateIban('')).not.toBeNull();
  });

  test('nur Buchstaben', () => {
    expect(validateIban('ABCDEFGHIJKLMNOP')).not.toBeNull();
  });

  test('Kleinbuchstaben werden akzeptiert', () => {
    expect(validateIban('de89370400440532013000')).toBeNull();
  });
});

// ── BIC Validierung ──────────────────────────────────────────────────────────

describe('validateBic', () => {
  test('gültiger 8-stelliger BIC', () => {
    expect(validateBic('COBADEFF')).toBeNull();
  });

  test('gültiger 11-stelliger BIC', () => {
    expect(validateBic('COBADEFFXXX')).toBeNull();
  });

  test('zu kurzer BIC', () => {
    expect(validateBic('COBA')).not.toBeNull();
  });

  test('leerer BIC', () => {
    expect(validateBic('')).not.toBeNull();
  });

  test('BIC mit Sonderzeichen', () => {
    expect(validateBic('COBAD@FF')).not.toBeNull();
  });

  test('Kleinbuchstaben werden akzeptiert', () => {
    expect(validateBic('cobadeff')).toBeNull();
  });
});
