import type { EventWithMeta } from '../../types';
import { exportCsv } from './csv';

export interface EventsLabels {
  name: string;
  client: string;
  startDate: string;
  endDate: string;
  destinations: string;
  passengers: string;
  status: string;
  statusLabel: (status: string) => string;
}

export function exportEventsCsv(agencyName: string, events: EventWithMeta[], L: EventsLabels) {
  const headers = [L.name, L.client, L.startDate, L.endDate, L.destinations, L.passengers, L.status];
  const rows = events.map((ev) => [
    ev.name,
    ev.client?.name ?? '',
    ev.start_date ?? '',
    ev.end_date ?? '',
    ev.destinations.join(' / '),
    ev.passenger_count,
    L.statusLabel(ev.status),
  ]);
  exportCsv(`eventos-${agencyName.toLowerCase().replace(/\s+/g, '-')}.csv`, headers, rows);
}
