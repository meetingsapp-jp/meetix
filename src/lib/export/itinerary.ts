import type { EventRow, PassengerWithMeta } from '../../types';
import { slug } from './download';

export interface ItineraryLabels {
  itinerary: string;
  event: string;
  passenger: string;
  flights: string;
  arrival: string;
  departure: string;
  hotel: string;
  room: string;
  contact: string;
  email: string;
  phone: string;
  emergency: string;
  notes: string;
  vip: string;
  generated: string;
  none: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

// A clean one-page PDF itinerary for a single passenger, branded with the agency.
function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function exportPassengerItinerary(
  agencyName: string,
  brandColor: string | null,
  event: EventRow,
  p: PassengerWithMeta,
  L: ItineraryLabels,
) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  const navy = hexToRgb(brandColor, [15, 23, 42]);
  const accent = hexToRgb(brandColor, [37, 99, 235]);

  // Header band
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(L.itinerary, M, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(180, 195, 220);
  doc.text(`${L.event}: ${event.name}`, M, 23);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(agencyName, W - M, 15, { align: 'right' });

  let y = 48;

  // Passenger name + VIP badge
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(p.full_name, M, y);
  if (p.is_vip) {
    doc.setFillColor(...accent);
    doc.roundedRect(M + doc.getTextWidth(p.full_name) + 4, y - 5.5, 16, 7, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(L.vip, M + doc.getTextWidth(p.full_name) + 12, y, { align: 'center' });
  }
  y += 6;
  doc.setDrawColor(220, 226, 236);
  doc.line(M, y, W - M, y);
  y += 12;

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...accent);
    doc.text(title.toUpperCase(), M, y);
    y += 7;
  };
  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(80, 90, 105);
    doc.text(`${label}:`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 27, 45);
    doc.text(value || L.none, M + 42, y);
    y += 7;
  };

  const flight = (dir: 'arrival' | 'departure') => p.flights.find((f) => f.direction === dir);
  const flightText = (dir: 'arrival' | 'departure') => {
    const f = flight(dir);
    if (!f) return '';
    return [[f.airline, f.flight_number].filter(Boolean).join(' '), fmt(f.flight_datetime)]
      .filter(Boolean)
      .join('  ·  ');
  };

  section(L.flights);
  line(L.arrival, flightText('arrival'));
  line(L.departure, flightText('departure'));
  y += 5;

  section(L.hotel);
  line(L.hotel, [p.hotel?.name ?? '', p.room_number ? `(${L.room} ${p.room_number})` : ''].filter(Boolean).join(' '));
  y += 5;

  section(L.contact);
  line(L.email, p.email ?? '');
  line(L.phone, p.phone ?? '');
  line(L.emergency, p.emergency_contact ?? '');

  if (p.notes) {
    y += 5;
    section(L.notes);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(20, 27, 45);
    doc.text(doc.splitTextToSize(p.notes, W - 2 * M), M, y);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 160, 175);
  doc.text(`MEETIX · ${L.generated}: ${new Date().toLocaleString()}`, M, 287);

  doc.save(`itinerario-${slug(p.full_name)}.pdf`);
}
