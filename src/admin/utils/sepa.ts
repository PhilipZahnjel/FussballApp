export type SepaTransaction = {
  endToEndId: string;
  amount: number;
  mandateReference: string;
  mandateDate: string;
  debtorName: string;
  debtorIban: string;
  debtorBic: string;
  description: string;
};

export type StudioConfig = {
  name: string;
  iban: string;
  bic: string;
  creditorId: string;
};

function fmt(n: number) {
  return n.toFixed(2);
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function nowIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function generateSepaXml(
  transactions: SepaTransaction[],
  studio: StudioConfig,
  collectionDate: string,
): string {
  const msgId = `MSG-${Date.now()}`;
  const pmtInfId = `PMT-${Date.now()}`;
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const count = transactions.length;

  const txBlocks = transactions.map(t => `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${t.endToEndId}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${fmt(t.amount)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${t.mandateReference}</MndtId>
            <DtOfSgntr>${t.mandateDate}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>${t.debtorBic}</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${t.debtorName}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${t.debtorIban.replace(/\s/g, '')}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${t.description}</Ustrd></RmtInf>
      </DrctDbtTxInf>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.003.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${nowIso()}</CreDtTm>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${fmt(total)}</CtrlSum>
      <InitgPty><Nm>${studio.name}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${fmt(total)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${collectionDate}</ReqdColltnDt>
      <Cdtr><Nm>${studio.name}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${studio.iban.replace(/\s/g, '')}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${studio.bic}</BIC></FinInstnId></CdtrAgt>
      <CdtrSchmeId>
        <Id><PrvtId><Othr>
          <Id>${studio.creditorId}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></PrvtId></Id>
      </CdtrSchmeId>${txBlocks}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

export function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
