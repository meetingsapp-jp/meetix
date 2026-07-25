// Domain types (UI-level). These mirror the intended schema but do NOT create
// any database structure — the actual schema is proposed separately and applied
// only after your approval.

export type EventStatus = 'planificacion' | 'confirmado' | 'en_curso' | 'finalizado' | 'cancelado';

export interface Client {
  id: string;
  name: string;
}

export interface EventRecord {
  id: string;
  name: string;
  clientId: string | null;
  startDate: string | null;
  endDate: string | null;
  destinations: string[];
  status: EventStatus;
}

export interface Passenger {
  id: string;
  eventId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentId: string | null; // passport / ID
  flightInfo: string | null;
  hotelAssignment: string | null;
  isVip: boolean;
  emergencyContact: string | null;
  notes: string | null;
}
