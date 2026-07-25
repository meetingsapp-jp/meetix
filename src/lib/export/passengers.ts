import type { EventRow, PassengerWithMeta } from '../../types';
import { exportCsv } from './csv';
import { downloadBlob, slug } from './download';

export interface PassengerExportLabels {
  sheet: string;
  name: string;
  email: string;
  phone: string;
  documentId: string;
  nationality: string;
  vip: string;
  yes: string;
  no: string;
  hotel: string;
  room: string;
  arrivalFlight: string;
  arrivalTime: string;
  departureFlight: string;
  departureTime: string;
  emergency: string;
  notes: string;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function flightNo(p: PassengerWithMeta, dir: 'arrival' | 'departure'): string {
  const f = p.flights.find((x) => x.direction === dir);
  return f ? [f.airline, f.flight_number].filter(Boolean).join(' ') : '';
}

function flightTime(p: PassengerWithMeta, dir: 'arrival' | 'departure'): string {
  const f = p.flights.find((x) => x.direction === dir);
  return f ? fmtDateTime(f.flight_datetime) : '';
}

function headers(L: PassengerExportLabels): string[] {
  return [
    L.name, L.email, L.phone, L.documentId, L.nationality, L.vip,
    L.hotel, L.room, L.arrivalFlight, L.arrivalTime, L.departureFlight, L.departureTime,
    L.emergency, L.notes,
  ];
}

function rows(passengers: PassengerWithMeta[], L: PassengerExportLabels): string[][] {
  return passengers.map((p) => [
    p.full_name,
    p.email ?? '',
    p.phone ?? '',
    p.document_id ?? '',
    p.nationality ?? '',
    p.is_vip ? L.yes : L.no,
    p.hotel?.name ?? '',
    p.room_number ?? '',
    flightNo(p, 'arrival'),
    flightTime(p, 'arrival'),
    flightNo(p, 'departure'),
    flightTime(p, 'departure'),
    p.emergency_contact ?? '',
    p.notes ?? '',
  ]);
}

export function exportPassengersCsv(event: EventRow, passengers: PassengerWithMeta[], L: PassengerExportLabels) {
  exportCsv(`pasajeros-${slug(event.name)}.csv`, headers(L), rows(passengers, L));
}

export async function exportPassengersXlsx(event: EventRow, passengers: PassengerWithMeta[], L: PassengerExportLabels) {
  // SheetJS is loaded on demand to keep the initial bundle small.
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers(L), ...rows(passengers, L)]);
  ws['!cols'] = headers(L).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, L.sheet);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    `pasajeros-${slug(event.name)}.xlsx`,
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
}
