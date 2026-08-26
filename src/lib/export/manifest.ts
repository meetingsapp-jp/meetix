import type { EventRow, PassengerWithMeta } from '../../types';
import { exportCsv } from './csv';
import { downloadBlob, slug } from './download';

// Column + section labels, translated by the caller.
export interface ManifestLabels {
  title: string;        // "Manifiesto de traslados"
  event: string;
  generated: string;
  arrivalsTitle: string; // "Llegadas (IN)"
  departuresTitle: string; // "Salidas (OUT)"
  date: string;
  time: string;
  passenger: string;
  flight: string;
  terminal: string;
  phone: string;
  destination: string;  // hotel (arrivals)
  origin: string;       // hotel (departures)
  direction: string;    // CSV column: "Sentido"
  in: string;
  out: string;
  empty: string;
}

// Date/time read straight from the ISO string (no timezone shift).
const dmy = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const hm = (iso: string | null) => (iso ? iso.slice(11, 16) : '');

function byTime(a: { dt: string | null }, b: { dt: string | null }) {
  return (a.dt ?? '').localeCompare(b.dt ?? '');
}

interface Leg {
  dt: string | null;
  passenger: string;
  flight: string;
  terminal: string;
  phone: string;
  hotel: string;
}

function legs(passengers: PassengerWithMeta[], dir: 'arrival' | 'departure'): Leg[] {
  return passengers
    .map((p) => {
      const f = p.flights.find((x) => x.direction === dir);
      if (!f) return null;
      return {
        dt: f.flight_datetime,
        passenger: p.full_name,
        flight: [f.airline, f.flight_number].filter(Boolean).join(' '),
        terminal: f.terminal ?? '',
        phone: p.phone ?? '',
        hotel: p.hotel?.name ?? '',
      } as Leg;
    })
    .filter((x): x is Leg => x !== null)
    .sort(byTime);
}

function arrivalRow(l: Leg): string[] {
  return [dmy(l.dt), hm(l.dt), l.passenger, l.flight, l.terminal, l.phone, l.hotel];
}
function departureRow(l: Leg): string[] {
  return [dmy(l.dt), hm(l.dt), l.passenger, l.hotel, l.flight, l.terminal, l.phone];
}

export function exportManifestCsv(event: EventRow, passengers: PassengerWithMeta[], L: ManifestLabels) {
  const headers = [L.direction, L.date, L.time, L.passenger, L.flight, L.terminal, L.phone, `${L.destination}/${L.origin}`];
  const rows = [
    ...legs(passengers, 'arrival').map((l) => [L.in, dmy(l.dt), hm(l.dt), l.passenger, l.flight, l.terminal, l.phone, l.hotel]),
    ...legs(passengers, 'departure').map((l) => [L.out, dmy(l.dt), hm(l.dt), l.passenger, l.flight, l.terminal, l.phone, l.hotel]),
  ];
  exportCsv(`traslados-${slug(event.name)}.csv`, headers, rows);
}

export async function exportManifestPdf(
  event: EventRow,
  passengers: PassengerWithMeta[],
  L: ManifestLabels,
  brandColor?: string | null,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  const head: [number, number, number] = hexToRgb(brandColor) ?? [15, 23, 42];

  doc.setFontSize(14);
  doc.text(L.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${L.event}: ${event.name}`, 14, 23);
  doc.text(`${L.generated}: ${new Date().toLocaleString()}`, 14, 28);

  const arr = legs(passengers, 'arrival');
  const dep = legs(passengers, 'departure');

  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text(L.arrivalsTitle, 14, 38);
  autoTable(doc, {
    startY: 41,
    head: [[L.date, L.time, L.passenger, L.flight, L.terminal, L.phone, L.destination]],
    body: arr.length ? arr.map(arrivalRow) : [[L.empty, '', '', '', '', '', '']],
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: head },
  });

  const afterArrivals = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(12);
  doc.text(L.departuresTitle, 14, afterArrivals + 10);
  autoTable(doc, {
    startY: afterArrivals + 13,
    head: [[L.date, L.time, L.passenger, L.origin, L.flight, L.terminal, L.phone]],
    body: dep.length ? dep.map(departureRow) : [[L.empty, '', '', '', '', '', '']],
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: head },
  });

  downloadBlob(`traslados-${slug(event.name)}.pdf`, doc.output('blob'));
}

function hexToRgb(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
