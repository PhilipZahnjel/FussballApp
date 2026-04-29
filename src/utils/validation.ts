export function validateIban(raw: string): string | null {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return 'Ungültige IBAN (Format: DE89 3704 0044 …)';
  }
  // ISO 7064 Mod-97 Prüfsumme
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 ? String(code - 55) : c;
  }).join('');
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  return remainder === 1 ? null : 'IBAN-Prüfsumme ungültig';
}

export function validateBic(raw: string): string | null {
  if (!raw.trim() || !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(raw.trim())) {
    return 'Ungültiger BIC (Format: COBADEFFXXX)';
  }
  return null;
}
