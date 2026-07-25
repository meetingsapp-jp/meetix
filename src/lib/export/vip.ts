import type { EventRow, PassengerWithMeta } from '../../types';
import { exportCsv } from './csv';
import { downloadBlob, slug } from './download';

// Column labels are passed in (translated by the caller) so exports respect the UI language.
export interface VipLabels {
  title: string;      // e.g. "Lista VIP - Transporte"
  event: string;
  generated: string;
  name: string;
  arrival: string;
  departure: string;
  hotel: string;
  room: string;
  phone: string;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function flightText(p: PassengerWithMeta, dir: 'arrival' | 'departure'): string {
  const f = p.flights.find((x) => x.direction === dir);
  if (!f) return '';
  return [[f.airline, f.flight_number].filter(Boolean).join(' '), fmtDateTime(f.flight_datetime)]
    .filter(Boolean)
    .join(' · ');
}

function vipRows(passengers: PassengerWithMeta[]): string[][] {
  return passengers
    .filter((p) => p.is_vip)
    .map((p) => [
      p.full_name,
      flightText(p, 'arrival'),
      flightText(p, 'departure'),
      p.hotel?.name ?? '',
      p.room_number ?? '',
      p.phone ?? '',
    ]);
}

export function vipCount(passengers: PassengerWithMeta[]): number {
  return passengers.filter((p) => p.is_vip).length;
}

export function exportVipCsv(event: EventRow, passengers: PassengerWithMeta[], L: VipLabels) {
  const headers = [L.name, L.arrival, L.departure, L.hotel, L.room, L.phone];
  exportCsv(`vip-${slug(event.name)}.csv`, headers, vipRows(passengers));
}

export async function exportVipPdf(event: EventRow, passengers: PassengerWithMeta[], L: VipLabels) {
  // Heavy PDF libs are loaded on demand so they don't bloat the initial bundle.
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(L.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${L.event}: ${event.name}`, 14, 23);
  doc.text(`${L.generated}: ${new Date().toLocaleString()}`, 14, 28);

  autoTable(doc, {
    startY: 33,
    head: [[L.name, L.arrival, L.departure, L.hotel, L.room, L.phone]],
    body: vipRows(passengers),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  downloadBlob(`vip-${slug(event.name)}.pdf`, doc.output('blob'));
}
