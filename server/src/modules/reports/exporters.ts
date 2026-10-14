import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { ATTENDANCE_STATUS_MARKS, type AttendanceStatus, type LateReportRow, type LeaveReportRow, type MonthlySheetDto } from '@hajira/shared';
import { formatClock, formatHuman } from '@/lib/time';

/** Status colours, matching the web app's thread palette. */
const STATUS_HEX: Record<AttendanceStatus, string> = {
  PRESENT: '2F8F5B',
  LATE: 'D9971C',
  ABSENT: 'C8372D',
  HALF_DAY: '0E8A8A',
  ON_LEAVE: '2F6FD6',
  HOLIDAY: '7A4CC2',
  WEEKEND: 'C9CDDB',
};
const INDIGO = '1E2756';

function sendWorkbook(res: Response, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  return wb.xlsx.write(res).then(() => res.end());
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${INDIGO}` } };
  row.alignment = { vertical: 'middle' };
  row.height = 22;
}

export async function monthlySheetXlsx(res: Response, sheet: MonthlySheetDto) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hajira';
  const ws = wb.addWorksheet(`Attendance ${sheet.month}`, { views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] });
  ws.columns = [
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Employee', key: 'name', width: 24 },
    { header: 'Department', key: 'dept', width: 18 },
    ...sheet.dates.map((d) => ({ header: d.slice(8), key: d, width: 4.2 })),
    { header: 'P', key: 'p', width: 5 },
    { header: 'L', key: 'l', width: 5 },
    { header: 'A', key: 'a', width: 5 },
    { header: 'H', key: 'h', width: 5 },
    { header: 'LV', key: 'lv', width: 5 },
    { header: 'Hours', key: 'hrs', width: 8 },
  ];
  styleHeader(ws.getRow(1));

  for (const r of sheet.rows) {
    const values: Record<string, string | number> = {
      code: r.user.employeeCode ?? '',
      name: r.user.name,
      dept: r.user.department ?? '',
      p: r.totals.present,
      l: r.totals.late,
      a: r.totals.absent,
      h: r.totals.halfDay,
      lv: r.totals.leave,
      hrs: r.totals.workHours,
    };
    sheet.dates.forEach((d, i) => (values[d] = r.days[i] ? ATTENDANCE_STATUS_MARKS[r.days[i]!] : ''));
    const row = ws.addRow(values);
    sheet.dates.forEach((_d, i) => {
      const s = r.days[i];
      if (!s) return;
      const cell = row.getCell(4 + i);
      cell.alignment = { horizontal: 'center' };
      cell.font = { bold: true, size: 9, color: { argb: s === 'WEEKEND' ? 'FF545B78' : 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${STATUS_HEX[s]}` } };
    });
  }
  ws.addRow([]);
  ws.addRow(['Legend: P present · L late · A absent · H half day · LV leave · HO holiday · W weekend']);
  await sendWorkbook(res, wb, `attendance-${sheet.month}`);
}

export async function lateXlsx(res: Response, data: { from: string; to: string; rows: LateReportRow[] }, tz: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Late arrivals');
  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Employee', key: 'name', width: 26 },
    { header: 'Department', key: 'dept', width: 20 },
    { header: 'Checked in', key: 'in', width: 12 },
    { header: 'Minutes late', key: 'late', width: 14 },
  ];
  styleHeader(ws.getRow(1));
  for (const r of data.rows) {
    ws.addRow({ date: r.date, code: r.user.employeeCode ?? '', name: r.user.name, dept: r.user.department ?? '', in: formatClock(new Date(r.checkIn), tz), late: r.lateMinutes });
  }
  await sendWorkbook(res, wb, `late-report-${data.from}-to-${data.to}`);
}

export async function leaveXlsx(res: Response, data: { from: string; to: string; rows: LeaveReportRow[] }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Leave');
  ws.columns = [
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Employee', key: 'name', width: 26 },
    { header: 'Department', key: 'dept', width: 20 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'From', key: 'from', width: 13 },
    { header: 'To', key: 'to', width: 13 },
    { header: 'Days', key: 'days', width: 8 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  styleHeader(ws.getRow(1));
  for (const r of data.rows) {
    ws.addRow({ code: r.user.employeeCode ?? '', name: r.user.name, dept: r.user.department ?? '', type: r.leaveType, from: r.startDate, to: r.endDate, days: r.days, status: r.status });
  }
  await sendWorkbook(res, wb, `leave-report-${data.from}-to-${data.to}`);
}

// ---------- PDF ----------

function pdf(res: Response, filename: string, layout: 'portrait' | 'landscape') {
  const doc = new PDFDocument({ size: 'A4', layout, margin: 32, info: { Title: filename, Author: 'Hajira' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  return doc;
}

function title(doc: PDFKit.PDFDocument, heading: string, sub: string) {
  doc.rect(0, 0, doc.page.width, 56).fill(`#${INDIGO}`);
  doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text(heading, 32, 18);
  doc.fontSize(9).font('Helvetica').text(sub, 32, 38);
  doc.fillColor('#141A33');
  doc.y = 72;
}

interface Col {
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

function table(doc: PDFKit.PDFDocument, cols: Col[], rows: string[][]) {
  const x0 = doc.page.margins.left;
  const rowH = 18;
  const drawHeader = () => {
    let x = x0;
    doc.rect(x0, doc.y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#EEF0F7');
    doc.fillColor('#545B78').font('Helvetica-Bold').fontSize(8);
    const y = doc.y + 5;
    for (const c of cols) {
      doc.text(c.label, x + 4, y, { width: c.width - 8, align: c.align ?? 'left' });
      x += c.width;
    }
    doc.y = y - 5 + rowH;
  };
  drawHeader();
  doc.font('Helvetica').fontSize(8.5).fillColor('#141A33');
  for (const row of rows) {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeader();
      doc.font('Helvetica').fontSize(8.5).fillColor('#141A33');
    }
    let x = x0;
    const y = doc.y + 5;
    row.forEach((cell, i) => {
      doc.text(cell, x + 4, y, { width: cols[i].width - 8, align: cols[i].align ?? 'left', lineBreak: false, ellipsis: true });
      x += cols[i].width;
    });
    doc.y = y - 5 + rowH;
    doc.moveTo(x0, doc.y).lineTo(x, doc.y).lineWidth(0.5).strokeColor('#E3E6F0').stroke();
  }
}

export function monthlySheetPdf(res: Response, sheet: MonthlySheetDto) {
  const doc = pdf(res, `attendance-${sheet.month}`, 'landscape');
  title(doc, `Monthly attendance · ${sheet.month}`, `${sheet.rows.length} employees · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  const nameW = 120;
  const cell = Math.min(18, (doc.page.width - 64 - nameW - 120) / sheet.dates.length);
  const x0 = doc.page.margins.left;

  const header = () => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#545B78');
    doc.text('Employee', x0, doc.y, { width: nameW });
    sheet.dates.forEach((d, i) => doc.text(d.slice(8), x0 + nameW + i * cell, doc.y - 8.5, { width: cell, align: 'center' }));
    const tx = x0 + nameW + sheet.dates.length * cell + 6;
    ['P', 'L', 'A', 'LV', 'Hrs'].forEach((h, i) => doc.text(h, tx + i * 24, doc.y - 8.5, { width: 24, align: 'center' }));
    doc.moveDown(0.6);
  };
  header();

  for (const r of sheet.rows) {
    if (doc.y + 16 > doc.page.height - 40) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      header();
    }
    const y = doc.y;
    doc.font('Helvetica').fontSize(8).fillColor('#141A33').text(r.user.name, x0, y + 3, { width: nameW - 6, lineBreak: false, ellipsis: true });
    r.days.forEach((s, i) => {
      if (!s) return;
      const cx = x0 + nameW + i * cell;
      // The stitch: a short bar per day in its status colour.
      doc.rect(cx + 2, y + 6, cell - 4, s === 'WEEKEND' ? 1 : 3).fill(`#${STATUS_HEX[s]}`);
    });
    const tx = x0 + nameW + sheet.dates.length * cell + 6;
    doc.fillColor('#141A33').fontSize(8);
    [r.totals.present, r.totals.late, r.totals.absent, r.totals.leave, r.totals.workHours].forEach((v, i) =>
      doc.text(String(v), tx + i * 24, y + 3, { width: 24, align: 'center' }),
    );
    doc.y = y + 16;
  }

  doc.moveDown();
  let lx = x0;
  (Object.keys(STATUS_HEX) as AttendanceStatus[]).forEach((s) => {
    doc.rect(lx, doc.y + 4, 12, 3).fill(`#${STATUS_HEX[s]}`);
    doc.fillColor('#545B78').fontSize(8).text(s.replace('_', ' ').toLowerCase(), lx + 16, doc.y, { lineBreak: false });
    lx += 80;
  });
  doc.end();
}

export function latePdf(res: Response, data: { from: string; to: string; rows: LateReportRow[]; summary: { averageMinutes: number } }, tz: string) {
  const doc = pdf(res, `late-report-${data.from}-to-${data.to}`, 'portrait');
  title(doc, 'Late arrivals', `${formatHuman(data.from)} – ${formatHuman(data.to)} · ${data.rows.length} late marks · average ${data.summary.averageMinutes} min`);
  table(
    doc,
    [
      { label: 'Date', width: 90 },
      { label: 'Employee', width: 150 },
      { label: 'Department', width: 120 },
      { label: 'In', width: 70, align: 'center' },
      { label: 'Minutes late', width: 100, align: 'right' },
    ],
    data.rows.map((r) => [formatHuman(r.date), r.user.name, r.user.department ?? '—', formatClock(new Date(r.checkIn), tz), String(r.lateMinutes)]),
  );
  doc.end();
}

export function leavePdf(res: Response, data: { from: string; to: string; rows: LeaveReportRow[] }) {
  const doc = pdf(res, `leave-report-${data.from}-to-${data.to}`, 'portrait');
  title(doc, 'Leave report', `${formatHuman(data.from)} – ${formatHuman(data.to)} · ${data.rows.length} requests`);
  table(
    doc,
    [
      { label: 'Employee', width: 130 },
      { label: 'Type', width: 90 },
      { label: 'From', width: 85 },
      { label: 'To', width: 85 },
      { label: 'Days', width: 50, align: 'right' },
      { label: 'Status', width: 90, align: 'right' },
    ],
    data.rows.map((r) => [r.user.name, r.leaveType, formatHuman(r.startDate), formatHuman(r.endDate), String(r.days), r.status.toLowerCase()]),
  );
  doc.end();
}
