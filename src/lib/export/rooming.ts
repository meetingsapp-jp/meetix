import type { EventRow, PassengerWithMeta } from '../../types';
import { exportCsv } from './csv';
import { downloadBlob, slug } from './download';

// Labels passed in translated so the export respects the UI language.
export interface RoomingLabels {
  title: string;      // e.g. "Lista de habitaciones"
  event: string;
  generated: string;
  hotel: string;
  room: string;
  guest: string;
  vip: string;
  phone: string;
  noHotel: string;    // bucket name for passengers without a hotel yet
}

// One row per passenger, sorted by hotel then room then name — the order a
// front desk / rooming list is read in.
function roomingRows(passengers: PassengerWithMeta[], L: RoomingLabels): string[][] {
  return passengers
    .slice()
    .sort((a, b) => {
      const ha = a.hotel?.name ?? '~';
      const hb = b.hotel?.name ?? '~';
      if (ha !== hb) return ha.localeCompare(hb);
      const ra = a.room_number ?? '';
      const rb = b.room_number ?? '';
      if (ra !== rb) return ra.localeCompare(rb, undefined, { numeric: true });
      return a.full_name.localeCompare(b.full_name);
    })
    .map((p) => [
      p.hotel?.name ?? L.noHotel,
      p.room_number ?? '',
      p.full_name,
      p.is_vip ? L.vip : '',
      p.phone ?? '',
    ]);
}

export function exportRoomingCsv(event: EventRow, passengers: PassengerWithMeta[], L: RoomingLabels) {
  const headers = [L.hotel, L.room, L.guest, L.vip, L.phone];
  exportCsv(`rooming-${slug(event.name)}.csv`, headers, roomingRows(passengers, L));
}

export async function exportRoomingPdf(
  event: EventRow,
  passengers: PassengerWithMeta[],
  L: RoomingLabels,
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

  autoTable(doc, {
    startY: 33,
    head: [[L.hotel, L.room, L.guest, L.vip, L.phone]],
    body: roomingRows(passengers, L),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: head },
  });

  downloadBlob(`rooming-${slug(event.name)}.pdf`, doc.output('blob'));
}

function hexToRgb(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
