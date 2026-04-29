import { generateSepaXml, SepaTransaction, StudioConfig } from '../admin/utils/sepa';

const studio: StudioConfig = {
  name: 'EMS Studio Groß-Gerau',
  iban: 'DE89370400440532013000',
  bic: 'COBADEFFXXX',
  creditorId: 'DE98ZZZ09999999999',
};

const tx: SepaTransaction = {
  endToEndId: 'ETE-001',
  amount: 49.99,
  mandateReference: 'MND-101-1234567890',
  mandateDate: '2026-01-15',
  debtorName: 'Max Mustermann',
  debtorIban: 'DE89 3704 0044 0532 0130 00',
  debtorBic: 'COBADEFFXXX',
  description: 'EMS Training April 2026',
};

describe('generateSepaXml', () => {
  let xml: string;

  beforeEach(() => {
    xml = generateSepaXml([tx], studio, '2026-05-01');
  });

  test('erzeugt gültiges XML (beginnt mit XML-Deklaration)', () => {
    expect(xml.startsWith('<?xml')).toBe(true);
  });

  test('enthält pain.008 Namespace', () => {
    expect(xml).toContain('pain.008.003.02');
  });

  test('enthält korrekte Gesamtsumme', () => {
    expect(xml).toContain('<CtrlSum>49.99</CtrlSum>');
  });

  test('enthält korrekte Transaktionszahl', () => {
    expect(xml).toContain('<NbOfTxs>1</NbOfTxs>');
  });

  test('enthält Debitornamen', () => {
    expect(xml).toContain('Max Mustermann');
  });

  test('enthält IBAN ohne Leerzeichen', () => {
    expect(xml).toContain('<IBAN>DE89370400440532013000</IBAN>');
    expect(xml).not.toContain('DE89 3704');
  });

  test('enthält Mandatsreferenz', () => {
    expect(xml).toContain('<MndtId>MND-101-1234567890</MndtId>');
  });

  test('enthält Inkassotermin', () => {
    expect(xml).toContain('<ReqdColltnDt>2026-05-01</ReqdColltnDt>');
  });

  test('enthält Verwendungszweck', () => {
    expect(xml).toContain('EMS Training April 2026');
  });

  test('mehrere Transaktionen: korrekte Summe', () => {
    const tx2: SepaTransaction = { ...tx, endToEndId: 'ETE-002', amount: 30.00 };
    const multiXml = generateSepaXml([tx, tx2], studio, '2026-05-01');
    expect(multiXml).toContain('<CtrlSum>79.99</CtrlSum>');
    expect(multiXml).toContain('<NbOfTxs>2</NbOfTxs>');
  });

  test('0 Transaktionen → Summe 0.00', () => {
    const emptyXml = generateSepaXml([], studio, '2026-05-01');
    expect(emptyXml).toContain('<CtrlSum>0.00</CtrlSum>');
    expect(emptyXml).toContain('<NbOfTxs>0</NbOfTxs>');
  });

  test('Betrag wird auf 2 Dezimalstellen gerundet', () => {
    const txRounded: SepaTransaction = { ...tx, amount: 49.999 };
    const roundedXml = generateSepaXml([txRounded], studio, '2026-05-01');
    expect(roundedXml).toContain('<InstdAmt Ccy="EUR">50.00</InstdAmt>');
  });
});
