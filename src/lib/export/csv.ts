import { downloadBlob } from './download';

function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(','));
  // BOM so Excel opens UTF-8 (accents) correctly.
  return '﻿' + lines.join('\r\n');
}

export function exportCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  downloadBlob(filename, new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' }));
}
