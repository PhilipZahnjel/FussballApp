// Studio-Stammdaten — hier zentral pflegen, nicht in einzelnen Screens
export const STUDIO = {
  name: 'Muster EMS Studio',
  address: 'Musterstraße 1, 12345 Musterstadt',
  phone: '01234 / 567 890',
  email: 'info@muster-ems-studio.de',
  hours: 'Mo–Fr 8–20 Uhr · Sa 9–14 Uhr',
};

// SEPA-Zugangsdaten des Studios für Lastschrifteinzug
// WICHTIG: Echte IBAN/BIC/GläubigerID hier eintragen vor Produktiveinsatz
export const STUDIO_SEPA = {
  name: STUDIO.name,
  iban: 'DE89 3704 0044 0532 0130 00',   // ← echte Studio-IBAN eintragen
  bic: 'COBADEFFXXX',                     // ← echten BIC eintragen
  creditorId: 'DE85ZZZ00000123456',        // ← echte Gläubiger-ID eintragen
};
