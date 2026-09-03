import type { EventRow, SessionWithMeta } from '../../types';
import { exportCsv } from './csv';
import { slug } from './download';

export interface AgendaLabels {
  date: string;
  start: string;
  end: string;
  name: string;
  type: string;
  location: string;
  attendees: string;
  noDate: string;
  typeLabel: (type: string) => string;
}

const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const isoTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');

export function exportAgendaCsv(event: EventRow, sessions: SessionWithMeta[], L: AgendaLabels) {
  const headers = [L.date, L.start, L.end, L.name, L.type, L.location, L.attendees];
  const rows = [...sessions]
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
    .map((s) => [
      isoDate(s.starts_at) || L.noDate,
      isoTime(s.starts_at),
      isoTime(s.ends_at),
      s.name,
      s.session_type ? L.typeLabel(s.session_type) : '',
      s.location ?? '',
      s.attendee_count,
    ]);
  exportCsv(`agenda-${slug(event.name)}.csv`, headers, rows);
}
