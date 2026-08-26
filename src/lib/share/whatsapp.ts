import type { EventRow, PassengerWithMeta } from '../../types';

export interface WhatsAppLabels {
  greeting: string;     // "Hola {{name}}! Este es tu itinerario:"
  hotel: string;
  room: string;
  arrival: string;
  departure: string;
  dietary: string;
  vip: string;
  signature: string;    // "Cualquier cambio te avisamos."
}

// Format a flight datetime straight from the ISO string (no timezone shift):
// "dd/mm · HH:mm".
function fmt(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  const time = iso.slice(11, 16);
  return `${d}/${m}${time ? ` · ${time}` : ''}`;
}

function flightLine(p: PassengerWithMeta, dir: 'arrival' | 'departure'): string {
  const f = p.flights.find((x) => x.direction === dir);
  if (!f) return '';
  return [[f.airline, f.flight_number].filter(Boolean).join(' '), fmt(f.flight_datetime)]
    .filter(Boolean)
    .join(' · ');
}

// Build a WhatsApp-ready itinerary message for one passenger. Uses emoji +
// blank lines (WhatsApp renders *bold*). Empty rows are omitted.
export function passengerItineraryText(
  agencyName: string,
  event: EventRow,
  p: PassengerWithMeta,
  L: WhatsAppLabels,
): string {
  const firstName = p.full_name.trim().split(/\s+/)[0];
  const lines: string[] = [];
  lines.push(`*${event.name}*`);
  lines.push('');
  lines.push(L.greeting.replace('{{name}}', firstName));
  lines.push('');
  if (p.is_vip) lines.push(`⭐ ${L.vip}`);
  if (p.hotel?.name) {
    lines.push(`🏨 ${L.hotel}: ${p.hotel.name}${p.room_number ? ` — ${L.room} ${p.room_number}` : ''}`);
  }
  const arr = flightLine(p, 'arrival');
  if (arr) lines.push(`🛬 ${L.arrival}: ${arr}`);
  const dep = flightLine(p, 'departure');
  if (dep) lines.push(`🛫 ${L.departure}: ${dep}`);
  if (p.dietary) lines.push(`🍽️ ${L.dietary}: ${p.dietary}`);
  lines.push('');
  lines.push(`${L.signature} — ${agencyName}`);
  return lines.join('\n');
}

// Open WhatsApp with the message prefilled. If the passenger has a phone we
// target that chat; otherwise WhatsApp lets the user pick a contact.
export function openWhatsApp(phone: string | null, text: string) {
  const digits = (phone ?? '').replace(/[^\d]/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
