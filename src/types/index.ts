// Domain types aligned with the database (snake_case columns).

export type Language = 'es' | 'en' | 'pt';
export type UserRole = 'director_general' | 'director_eventos' | 'planificador' | 'guia_coordinador';
export type EventStatus = 'planificacion' | 'confirmado' | 'en_curso' | 'finalizado' | 'cancelado';
export type TransportType = 'vip' | 'group';
export type FlightDirection = 'arrival' | 'departure';

export interface Agency {
  id: string;
  name: string;
  default_language: Language;
  created_at: string;
}

export interface Client {
  id: string;
  agency_id: string;
  name: string;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  agency_id: string;
  client_id: string | null;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destinations: string[];
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

// Event joined with its client name + passenger count (for list/dashboard).
export interface EventWithMeta extends EventRow {
  client: { name: string } | null;
  passenger_count: number;
}

export interface Passenger {
  id: string;
  agency_id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  nationality: string | null;
  is_vip: boolean;
  transport_type: TransportType;
  transport_provider_id: string | null;
  hotel_id: string | null;
  room_number: string | null;
  emergency_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
