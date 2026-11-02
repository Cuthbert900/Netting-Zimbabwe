// Turns a ReportTableData (or a narrative string) into a downloaded file —
// PDF via jsPDF + jspdf-autotable, Excel/CSV via the same SheetJS (xlsx)
// package already used to parse uploaded extracts. Both run entirely in
// the browser; nothing is sent to a server.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ReportTableData } from '@/lib/reports';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function pdfHeader(
  doc: jsPDF,
  title: string,
  description: string,
  generatedAt: string
) {
  doc.setFontSize(16);
  doc.setTextColor(15, 110, 79);
  doc.text(title, 40, 44);
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  const wrapped = doc.splitTextToSize(description, 520);
  doc.text(wrapped, 40, 62);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Netting Reconciliation Automation — Liquid Intelligent Technologies — generated ${new Date(generatedAt).toLocaleString()}`,
    40,
    62 + wrapped.length * 11 + 10
  );
  return 62 + wrapped.length * 11 + 22;
}

/** Exports a tabular report (summary, exceptions, duplicates) as a PDF. */
export function exportReportToPdf(data: ReportTableData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = pdfHeader(doc, data.title, data.description, data.generatedAt);

  if (data.meta.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    for (const line of data.meta) {
      doc.text(`• ${line}`, 40, y);
      y += 14;
    }
    y += 6;
  }

  autoTable(doc, {
    startY: y,
    head: [data.columns],
    body:
      data.rows.length > 0
        ? data.rows
        : [
            [
              'No records for this period',
              ...Array(data.columns.length - 1).fill(''),
            ],
          ],
    headStyles: { fillColor: [15, 110, 79], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [246, 248, 247] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${slugify(data.title)}-${stamp()}.pdf`);
}

/** Exports a tabular report as an .xlsx workbook — one sheet, meta lines
 * as leading rows above the header so the numbers stay easy to scan. */
export function exportReportToExcel(data: ReportTableData): void {
  const aoa: (string | number)[][] = [];
  aoa.push([data.title]);
  aoa.push([data.description]);
  aoa.push([`Generated ${new Date(data.generatedAt).toLocaleString()}`]);
  aoa.push([]);
  for (const line of data.meta) aoa.push([line]);
  aoa.push([]);
  aoa.push(data.columns);
  for (const row of data.rows) aoa.push(row);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = data.columns.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.title.slice(0, 31));
  XLSX.writeFile(wb, `${slugify(data.title)}-${stamp()}.xlsx`);
}

/** Exports the AI narrative summary as a PDF — prose, not a table. */
export function exportNarrativeToPdf(
  periodLabel: string,
  narrative: string,
  demo: boolean
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = pdfHeader(
    doc,
    'AI-Written Narrative Summary',
    `An AI-generated read of the current reconciliation period (${periodLabel}).`,
    new Date().toISOString()
  );

  if (demo) {
    doc.setFontSize(8);
    doc.setTextColor(180, 120, 20);
    doc.text(
      'Demo mode — no API key configured for the AI provider at generation time.',
      40,
      y
    );
    y += 16;
  }

  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(narrative, 520);
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 44;
    }
    doc.text(line, 40, y);
    y += 14;
  }

  doc.save(`ai-narrative-summary-${stamp()}.pdf`);
}

/** Exports the AI narrative summary as an .xlsx — one row per paragraph,
 * since prose has no natural columns; the PDF is the primary format. */
export function exportNarrativeToExcel(
  periodLabel: string,
  narrative: string,
  demo: boolean
): void {
  const aoa: string[][] = [
    ['AI-Written Narrative Summary'],
    [`Period: ${periodLabel}`],
    [`Generated ${new Date().toLocaleString()}`],
    [
      demo
        ? 'Demo mode — no API key configured for the AI provider at generation time.'
        : '',
    ],
    [],
    ...narrative
      .split(/\n+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => [p]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 100 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Narrative Summary');
  XLSX.writeFile(wb, `ai-narrative-summary-${stamp()}.xlsx`);
}
