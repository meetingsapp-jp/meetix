import { downloadBlob } from '../export/download';

// One structured, parsed row from the uploaded spreadsheet.
export interface ParsedFlight {
  airline: string | null;
  flight_number: string | null;
  flight_datetime: string | null;
}
export interface ParsedRow {
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  nationality: string | null;
  is_vip: boolean;
  hotel: string | null;
  room_number: string | null;
  emergency_contact: string | null;
  notes: string | null;
  arrival: ParsedFlight;
  departure: ParsedFlight;
  valid: boolean;
}

// Accepted column headers (normalized, accent/case-insensitive). Spanish first,
// with a few English aliases so most real spreadsheets map automatically.
const ALIASES: Record<string, string[]> = {
  full_name: ['nombre completo', 'nombre', 'nombre y apellido', 'pasajero', 'full name', 'name'],
  email: ['email', 'correo', 'e-mail', 'mail'],
  phone: ['telefono', 'teléfono', 'phone', 'celular', 'tel', 'movil', 'móvil'],
  document_id: ['pasaporte/id', 'pasaporte / id', 'pasaporte', 'documento', 'dni', 'id', 'passport'],
  nationality: ['nacionalidad', 'nationality', 'pais', 'país', 'country'],
  is_vip: ['vip', 'transporte'],
  hotel: ['hotel', 'alojamiento'],
  room_number: ['habitacion', 'habitación', 'room', 'cuarto', 'hab'],
  emergency_contact: ['contacto emergencia', 'contacto de emergencia', 'emergencia', 'emergency'],
  notes: ['notas', 'nota', 'notes', 'observaciones'],
  arr_airline: ['aerolinea llegada', 'aerolínea llegada', 'airline arrival'],
  arr_flight: ['vuelo llegada', 'nro vuelo llegada', 'arrival flight', 'vuelo de llegada'],
  arr_datetime: ['fecha llegada', 'llegada', 'arrival', 'fecha/hora llegada'],
  dep_airline: ['aerolinea salida', 'aerolínea salida', 'airline departure'],
  dep_flight: ['vuelo salida', 'departure flight', 'vuelo de salida'],
  dep_datetime: ['fecha salida', 'salida', 'departure', 'fecha/hora salida'],
};

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const clean = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

const VIP_TRUE = new Set(['si', 'sí', 'vip', 'x', 'true', '1', 'yes', 'y', 'verdadero']);

function toIso(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function parsePassengerFile(file: File): Promise<ParsedRow[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  if (!raw.length) return [];

  // Resolve each field to the actual header present in the file.
  const headerMap: Record<string, string> = {};
  for (const key of Object.keys(raw[0])) {
    const nk = norm(key);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!headerMap[field] && aliases.some((a) => norm(a) === nk)) headerMap[field] = key;
    }
  }
  const val = (row: Record<string, unknown>, field: string) =>
    headerMap[field] !== undefined ? row[headerMap[field]] : '';

  return raw.map((row) => {
    const full_name = String(val(row, 'full_name') ?? '').trim();
    return {
      full_name,
      email: clean(val(row, 'email')),
      phone: clean(val(row, 'phone')),
      document_id: clean(val(row, 'document_id')),
      nationality: clean(val(row, 'nationality')),
      is_vip: VIP_TRUE.has(norm(val(row, 'is_vip'))),
      hotel: clean(val(row, 'hotel')),
      room_number: clean(val(row, 'room_number')),
      emergency_contact: clean(val(row, 'emergency_contact')),
      notes: clean(val(row, 'notes')),
      arrival: {
        airline: clean(val(row, 'arr_airline')),
        flight_number: clean(val(row, 'arr_flight')),
        flight_datetime: toIso(val(row, 'arr_datetime')),
      },
      departure: {
        airline: clean(val(row, 'dep_airline')),
        flight_number: clean(val(row, 'dep_flight')),
        flight_datetime: toIso(val(row, 'dep_datetime')),
      },
      valid: full_name.length > 0,
    };
  });
}

// Downloads a ready-to-fill template with the expected columns + one example row.
export async function downloadPassengerTemplate() {
  const XLSX = await import('xlsx');
  const headers = [
    'Nombre completo', 'Email', 'Teléfono', 'Pasaporte/ID', 'Nacionalidad', 'VIP',
    'Hotel', 'Habitación', 'Contacto emergencia', 'Notas',
    'Aerolínea llegada', 'Vuelo llegada', 'Fecha llegada',
    'Aerolínea salida', 'Vuelo salida', 'Fecha salida',
  ];
  const example = [
    'Juan Pérez', 'juan@mail.com', '+54 11 5555 5555', 'AAA123456', 'Argentina', 'Sí',
    'Hotel Sheraton', '1201', 'María Pérez +54 11 4444 4444', 'Ventana',
    'Aerolíneas Argentinas', 'AR1709', '2026-08-01 09:15',
    'KLM', 'KL701', '2026-08-05 05:00',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pasajeros');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    'plantilla-pasajeros.xlsx',
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
}
