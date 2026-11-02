// Renders the Netting Account Reconciliation front page — the signed-off
// month-end sheet — as a PDF (jsPDF) and as an Excel workbook (ExcelJS,
// which unlike the SheetJS build used elsewhere can write borders, bold
// boxes and the logo). Both follow the layout of the reconciliation pack the
// Treasury team already signs: header and logo, account details, the
// numbered balance lines in boxes, Comments, then the sign-off block with
// designations only and blank name, signature and date lines.

import { jsPDF } from 'jspdf';
import {
  NETTING_ACCOUNT,
  formatAccounting,
  formatPeriodClosing,
  formatPeriodOpening,
  formatPeriodShort,
  type BalanceFigures,
  type ReportingPeriod,
} from '@/lib/balance-reconciliation';

export interface FrontPageData {
  period: ReportingPeriod;
  currency: string;
  figures: BalanceFigures;
  items: { label: string; value: number | null }[];
  comments: string;
  /** Why the page isn't ready for sign-off; non-empty marks the export as
   * a draft. */
  draftReasons: string[];
}

export const SIGN_OFF_DESIGNATIONS = [
  'Prepared by:',
  'Seconded by:',
  'Reviewed by:',
  'Authorised by:',
  '', // second authoriser — the pack has two lines under "Authorised by"
];

const LOGO_URL = '/logos/liquid-colour.png';
const LOGO_ASPECT = 261 / 900;
const HEADER_BLUE: [number, number, number] = [31, 58, 122];

function fileStem(period: ReportingPeriod, currency: string): string {
  return `netting-account-reconciliation-${period.year}-${String(period.month).padStart(2, '0')}-${currency.toLowerCase()}`;
}

async function loadLogo(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(LOGO_URL);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function toBase64(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function lines(data: FrontPageData) {
  const { figures, period } = data;
  return {
    opening: `1. Balance as at ${formatPeriodOpening(period)}`,
    gl: `2. Balance as per General Ledger (TB)- ${formatPeriodClosing(period)}`,
    figures,
  };
}

// ---- PDF -------------------------------------------------------------------

export async function exportFrontPageToPdf(data: FrontPageData): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const L = 40;
  const R = 555;
  const BOX_X = 395;
  const BOX_W = R - BOX_X;
  const { opening, gl, figures } = lines(data);

  const box = (y: number, value: number | null) => {
    doc.setLineWidth(1.2);
    doc.setDrawColor(0);
    doc.rect(BOX_X, y - 13, BOX_W, 18);
    doc.setFont('helvetica', 'bold');
    doc.text(formatAccounting(value, 'number'), R - 4, y, { align: 'right' });
  };
  const label = (text: string, y: number, bold = true) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(text, L, y);
  };
  const rule = (y: number) => {
    doc.setLineWidth(1.5);
    doc.line(L, y, R, y);
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...HEADER_BLUE);
  doc.text(['Netting Account', 'Reconciliation'], L, 64);
  const logo = await loadLogo();
  if (logo) {
    const w = 130;
    doc.addImage(
      `data:image/png;base64,${toBase64(logo)}`,
      'PNG',
      R - w,
      44,
      w,
      w * LOGO_ASPECT
    );
  }
  doc.setTextColor(0);
  if (data.draftReasons.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(190, 18, 60);
    doc.text('DRAFT — NOT FOR SIGN-OFF', L, 94);
    doc.setTextColor(0);
  }
  rule(100);

  // Account details
  doc.setFontSize(10);
  const details: [string, string][] = [
    ['General Ledger Account Name', NETTING_ACCOUNT.name],
    ['General Ledger Account Number', NETTING_ACCOUNT.number],
    ['Financial Reporting Period', formatPeriodShort(data.period)],
  ];
  details.forEach(([k, v], i) => {
    const y = 132 + i * 28;
    label(k, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, 202, y);
    doc.setLineWidth(0.8);
    doc.line(198, y + 4, R, y + 4);
  });

  // Balance lines
  doc.setFont('helvetica', 'bold');
  doc.text(data.currency, R - 4, 230, { align: 'right' });
  label(opening, 248);
  box(248, figures.openingBalance);

  label('1.1. Reconciling Items:', 282);
  box(282, figures.reconcilingTotal);
  data.items.forEach((item, i) => {
    const y = 300 + i * 16;
    label(item.label, y, false);
    doc.setFont('helvetica', 'normal');
    doc.text(formatAccounting(item.value), R - 4, y, { align: 'right' });
  });

  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal', BOX_X - 6, 376, { align: 'right' });
  box(376, figures.subtotal);
  label(gl, 412);
  box(412, figures.glBalance);
  label('3. Difference', 448);
  box(448, figures.difference);

  // Comments
  label('Comments', 484);
  doc.setLineWidth(1.5);
  doc.rect(L, 490, R - L, 84);
  // Shrink the text until it fits the box rather than cutting it off.
  doc.setFont('helvetica', 'normal');
  let size = 9;
  let wrapped: string[] = [];
  for (; size >= 6; size -= 0.5) {
    doc.setFontSize(size);
    wrapped = doc.splitTextToSize(data.comments.trim(), R - L - 12);
    if (wrapped.length * size * 1.15 <= 76) break;
  }
  doc.text(wrapped, L + 6, 494 + size, { lineHeightFactor: 1.15 });
  doc.setFontSize(10);

  // Sign-off
  rule(600);
  SIGN_OFF_DESIGNATIONS.forEach((designation, i) => {
    const y = 628 + i * 28;
    if (designation) label(designation, y);
    doc.setLineWidth(0.6);
    doc.line(200, y + 3, 320, y + 3); // name
    doc.line(335, y + 3, 425, y + 3); // signature
    doc.line(440, y + 3, R, y + 3); // date
  });
  rule(762);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (data.draftReasons.length > 0) {
    doc.setTextColor(190, 18, 60);
    doc.text(
      doc.splitTextToSize(`Draft: ${data.draftReasons.join(' ')}`, R - L),
      L,
      774
    );
  }
  doc.setTextColor(140);
  doc.text(
    `Generated by Netting Reconciliation Automation on ${new Date().toLocaleDateString('en-GB')} from the uploaded extracts.`,
    L,
    800
  );

  doc.save(
    `${fileStem(data.period, data.currency)}${data.draftReasons.length ? '-draft' : ''}.pdf`
  );
}

// ---- Excel -----------------------------------------------------------------

const ACCOUNTING_FMT = '#,##0.00;(#,##0.00);"-"';
/** Boxed totals show zero as 0.00, like the pack's Difference box. */
const BOXED_FMT = '#,##0.00;(#,##0.00)';

export async function exportFrontPageToExcel(
  data: FrontPageData
): Promise<void> {
  // Loaded on demand: ExcelJS is large and only needed at export time.
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Netting Reconciliation Automation';
  const ws = wb.addWorksheet('Recon', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });
  ws.columns = [
    { width: 2 },
    { width: 44 },
    { width: 24 },
    { width: 20 },
    { width: 22 },
  ];
  const { opening, gl, figures } = lines(data);
  const font = { name: 'Calibri', size: 11 };
  const bold = { ...font, bold: true };
  const medium = { style: 'medium' as const };
  const thin = { style: 'thin' as const };
  const boxed = { top: medium, left: medium, bottom: medium, right: medium };

  const setValue = (
    addr: string,
    value: number | null | { formula: string; result: number | null },
    isBoxed = true
  ) => {
    const cell = ws.getCell(addr);
    if (value === null) cell.value = 'n/a';
    else if (typeof value === 'number') cell.value = value;
    else
      cell.value =
        value.result === null
          ? 'n/a'
          : { formula: value.formula, result: value.result };
    cell.numFmt = isBoxed ? BOXED_FMT : ACCOUNTING_FMT;
    cell.alignment = { horizontal: 'right' };
    cell.font = isBoxed ? bold : font;
    if (isBoxed) cell.border = boxed;
  };
  const setLabel = (addr: string, text: string, isBold = true) => {
    const cell = ws.getCell(addr);
    cell.value = text;
    cell.font = isBold ? bold : font;
  };
  const ruleBelow = (row: number) => {
    for (const col of ['B', 'C', 'D', 'E'])
      ws.getCell(`${col}${row}`).border = { bottom: medium };
  };

  // Header
  const title = ws.getCell('B2');
  title.value = 'Netting Account\nReconciliation';
  title.font = { ...bold, color: { argb: 'FF1F3A7A' } };
  title.alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(2).height = 46;
  // Room for a few lines of comments in the merged box below.
  for (const r of [28, 29, 30, 31]) ws.getRow(r).height = 22;
  const logo = await loadLogo();
  if (logo) {
    const imageId = wb.addImage({ base64: toBase64(logo), extension: 'png' });
    ws.addImage(imageId, {
      tl: { col: 3.4, row: 1.1 },
      ext: { width: 150, height: 150 * LOGO_ASPECT },
    });
  }
  if (data.draftReasons.length > 0) {
    const draft = ws.getCell('B1');
    draft.value = `DRAFT — NOT FOR SIGN-OFF. ${data.draftReasons.join(' ')}`;
    draft.font = { ...bold, color: { argb: 'FFBE123C' } };
  }
  ruleBelow(3);

  // Account details
  const details: [number, string, string][] = [
    [5, 'General Ledger Account Name', NETTING_ACCOUNT.name],
    [7, 'General Ledger Account Number', NETTING_ACCOUNT.number],
    [9, 'Financial Reporting Period', formatPeriodShort(data.period)],
  ];
  for (const [row, k, v] of details) {
    setLabel(`B${row}`, k);
    ws.mergeCells(`C${row}:E${row}`);
    const cell = ws.getCell(`C${row}`);
    cell.value = v;
    cell.font = font;
    cell.border = { bottom: thin };
  }

  // Balance lines
  setLabel('E12', data.currency);
  ws.getCell('E12').alignment = { horizontal: 'right' };
  setLabel('B13', opening);
  setValue('E13', figures.openingBalance);

  setLabel('B15', '1.1. Reconciling Items:');
  setValue('E15', {
    formula: 'SUM(E16:E18)',
    result: figures.reconcilingTotal,
  });
  data.items.forEach((item, i) => {
    setLabel(`B${16 + i}`, item.label, false);
    setValue(`E${16 + i}`, item.value, false);
  });

  setLabel('D21', 'Subtotal');
  ws.getCell('D21').alignment = { horizontal: 'right' };
  setValue('E21', { formula: 'E13+E15', result: figures.subtotal });
  setLabel('B23', gl);
  setValue('E23', figures.glBalance);
  setLabel('B25', '3. Difference');
  setValue('E25', { formula: 'E21-E23', result: figures.difference });

  // Comments
  setLabel('B27', 'Comments');
  ws.mergeCells('B28:E31');
  const comments = ws.getCell('B28');
  comments.value = data.comments.trim();
  comments.font = font;
  comments.alignment = { wrapText: true, vertical: 'top' };
  comments.border = boxed;

  // Sign-off
  ruleBelow(33);
  SIGN_OFF_DESIGNATIONS.forEach((designation, i) => {
    const row = 35 + i * 2;
    if (designation) setLabel(`B${row}`, designation);
    for (const col of ['C', 'D', 'E'])
      ws.getCell(`${col}${row}`).border = { bottom: thin };
  });
  ruleBelow(44);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileStem(data.period, data.currency)}${data.draftReasons.length ? '-draft' : ''}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
