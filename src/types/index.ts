// Domain types aligned with the database (snake_case columns).

export type Language = 'es' | 'en' | 'pt';
export type UserRole = 'director_general' | 'director_eventos' | 'planificador' | 'guia_coordinador';
export type EventStatus = 'planificacion' | 'confirmado' | 'en_curso' | 'finalizado' | 'cancelado';
export type TransportType = 'vip' | 'group';
export type FlightDirection = 'arrival' | 'departure';
export type SessionType = 'charla' | 'comida' | 'traslado' | 'actividad' | 'libre';

export interface AppUser {
  id: string;
  agency_id: string;
  auth_user_id: string | null;
  full_name: string;
  role: UserRole;
  email: string | null;
  preferred_language: Language;
  created_at: string;
}

export interface Agency {
  id: string;
  name: string;
  default_language: Language;
  brand_color: string | null;
  logo_url: string | null;
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

export interface Hotel {
  id: string;
  agency_id: string;
  event_id: string;
  name: string;
  address: string | null;
  check_in: string | null;
  check_out: string | null;
  created_at: string;
}

export interface TransportProvider {
  id: string;
  agency_id: string;
  event_id: string;
  name: string;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Flight {
  id: string;
  agency_id: string;
  passenger_id: string;
  direction: FlightDirection;
  airline: string | null;
  flight_number: string | null;
  flight_datetime: string | null;
  terminal: string | null;
  origin_airport: string | null;
  destination_airport: string | null;
  created_at: string;
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
  dietary: string | null;
  allergies: string | null;
  special_needs: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Passenger joined with hotel name, transport provider and its flights.
export interface PassengerWithMeta extends Passenger {
  hotel: { name: string } | null;
  transport_provider: { name: string } | null;
  flights: Flight[];
}

export interface Session {
  id: string;
  agency_id: string;
  event_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  session_type: SessionType | null;
  location: string | null;
  created_at: string;
}

// Session joined with its attendance count (for the agenda list).
export interface SessionWithMeta extends Session {
  attendee_count: number;
}
