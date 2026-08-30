import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import { inputClass } from '../../components/ui/Field';
import { listAssignedEventIds, listEvents } from '../../data/events';
import { listPassengers } from '../../data/passengers';
import { listSessions } from '../../data/sessions';
import {
  createIncident,
  deleteIncident,
  listArrivedIds,
  listIncidents,
  setArrived,
  setIncidentResolved,
  type Incident,
  type IncidentSeverity,
} from '../../data/coordinator';
import type { EventWithMeta, PassengerWithMeta, SessionType, SessionWithMeta } from '../../types';
import PassengerTransportModal from './PassengerTransportModal';
import { flightStatusUrl, googleMapsUrl } from '../../lib/links';

type Tab = 'today' | 'recepcion' | 'despacho' | 'funciones' | 'pasajeros' | 'incidencias';

const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const isoTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');
const dm = (iso: string | null) => {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};
const telHref = (phone: string | null) => `tel:${(phone ?? '').replace(/[^\d+]/g, '')}`;
const waHref = (phone: string | null) => `https://wa.me/${(phone ?? '').replace(/[^\d]/g, '')}`;

const typeChip: Record<SessionType, string> = {
  charla: 'bg-blue-100 text-blue-700',
  comida: 'bg-amber-100 text-amber-800',
  traslado: 'bg-violet-100 text-violet-700',
  actividad: 'bg-green-100 text-green-700',
  libre: 'bg-slate-100 text-slate-600',
};
const sevStyle: Record<IncidentSeverity, string> = {
  info: 'bg-slate-100 text-slate-600',
  warning: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-700',
};

export default function CoordinatorPage() {
  const { t, i18n } = useTranslation();
  const { agency, appUser, role } = useAuth();

  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [eventId, setEventId] = useState('');
  const [passengers, setPassengers] = useState<PassengerWithMeta[]>([]);
  const [sessions, setSessions] = useState<SessionWithMeta[]>([]);
  const [arrived, setArrivedSet] = useState<Set<string>>(new Set());
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerWithMeta | null>(null);

  // Load events, default to the nearest non-finished one. Coordinators only
  // see the events a Director has assigned them to.
  useEffect(() => {
    if (!agency) return;
    Promise.all([
      listEvents(agency.id),
      role === 'guia_coordinador' && appUser ? listAssignedEventIds(appUser.id) : Promise.resolve(null),
    ])
      .then(([evs, assignedIds]) => {
        const visible = assignedIds ? evs.filter((e) => assignedIds.includes(e.id)) : evs;
        setEvents(visible);
        if (visible.length && !eventId) {
          const active = visible.find((e) => e.status !== 'finalizado' && e.status !== 'cancelado');
          setEventId((active ?? visible[0]).id);
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency, role, appUser]);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [pax, ss, arr, inc] = await Promise.all([
        listPassengers(eventId),
        listSessions(eventId),
        listArrivedIds(eventId),
        listIncidents(eventId),
      ]);
      setPassengers(pax);
      setSessions(ss);
      setArrivedSet(new Set(arr));
      setIncidents(inc);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) load();
  }, [eventId, load]);

  // Real-time sync: reload data when arrival_checkins or incidents change
  const realtimeChannelRef = useRef<any>(null);
  useEffect(() => {
    if (!supabase || !eventId) return;

    const channel = supabase
      .channel(`coordinator:${eventId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'arrival_checkins' },
        () => load(),
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'incidents' },
        () => load(),
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) realtimeChannelRef.current.unsubscribe();
    };
  }, [eventId, load]);

  const event = events.find((e) => e.id === eventId) ?? null;

  async function toggleArrived(p: PassengerWithMeta) {
    if (!agency) return;
    const next = !arrived.has(p.id);
    setArrivedSet((prev) => {
      const s = new Set(prev);
      if (next) s.add(p.id);
      else s.delete(p.id);
      return s;
    });
    try {
      await setArrived(agency.id, p.id, next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const vipCount = passengers.filter((p) => p.is_vip).length;
  const openIncidents = incidents.filter((i) => !i.resolved).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: t('coordinator.tabs.today') },
    { id: 'recepcion', label: 'Recepción' },
    { id: 'despacho', label: 'Despacho' },
    { id: 'funciones', label: 'Funciones' },
    { id: 'pasajeros', label: t('coordinator.tabs.passengers') },
    { id: 'incidencias', label: t('coordinator.tabs.incidents') },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{t('coordinator.title')}</h1>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{t('coordinator.onsite')}</span>
      </div>

      <select className={`${inputClass} mb-3`} value={eventId} onChange={(e) => setEventId(e.target.value)}>
        <option value="">{t('transport.selectEvent')}</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!eventId ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {role === 'guia_coordinador' && events.length === 0 ? t('coordinator.noEventsAssigned') : t('transport.pickEventHint')}
        </p>
      ) : (
        <>
          {/* Tab bar */}
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                  tab === tb.id ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tb.label}
                {tb.id === 'incidencias' && openIncidents > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs text-white">{openIncidents}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-slate-500">{t('common.loading')}</p>
          ) : (
            <>
              {tab === 'today' && (
                <TodayTab
                  event={event}
                  passengers={passengers}
                  sessions={sessions}
                  arrived={arrived}
                  vipCount={vipCount}
                  openIncidents={openIncidents}
                  onToggleArrived={toggleArrived}
                  lang={i18n.resolvedLanguage}
                />
              )}
              {tab === 'recepcion' && (
                <RecepcionTab passengers={passengers} arrived={arrived} onToggleArrived={toggleArrived} onSelectPassenger={setSelectedPassenger} />
              )}
              {tab === 'despacho' && (
                <DespachoTab passengers={passengers} onSelectPassenger={setSelectedPassenger} />
              )}
              {tab === 'funciones' && <FuncionesTab sessions={sessions} eventId={eventId} lang={i18n.resolvedLanguage} />}
              {tab === 'pasajeros' && (
                <PasajerosTab passengers={passengers} arrived={arrived} onToggleArrived={toggleArrived} />
              )}
              {tab === 'incidencias' && (
                <IncidenciasTab
                  agencyId={agency?.id ?? ''}
                  eventId={eventId}
                  authorName={appUser?.full_name ?? null}
                  passengers={passengers}
                  incidents={incidents}
                  onChanged={setIncidents}
                />
              )}
            </>
          )}
        </>
      )}

      <PassengerTransportModal
        open={selectedPassenger !== null}
        passenger={selectedPassenger}
        onClose={() => setSelectedPassenger(null)}
      />
    </div>
  );
}

// --- Reusable bits -----------------------------------------------------------

function ArrivedToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${
        on ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {on ? `✓ ${t('coordinator.arrived')}` : t('coordinator.markArrived')}
    </button>
  );
}

function reqChips(p: PassengerWithMeta) {
  return (
    <>
      {p.dietary && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">🍽️ {p.dietary}</span>}
      {p.allergies && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">⚠️ {p.allergies}</span>}
      {p.special_needs && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">♿ {p.special_needs}</span>}
    </>
  );
}

function contactButtons(p: PassengerWithMeta, tCall: string) {
  if (!p.phone) return null;
  return (
    <div className="flex gap-2">
      <a href={telHref(p.phone)} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
        📞 {tCall}
      </a>
      <a href={waHref(p.phone)} target="_blank" rel="noopener" className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
        WhatsApp
      </a>
    </div>
  );
}

// --- Tabs --------------------------------------------------------------------

function TodayTab({
  event,
  passengers,
  sessions,
  arrived,
  vipCount,
  openIncidents,
  onToggleArrived,
  lang,
}: {
  event: EventWithMeta | null;
  passengers: PassengerWithMeta[];
  sessions: SessionWithMeta[];
  arrived: Set<string>;
  vipCount: number;
  openIncidents: number;
  onToggleArrived: (p: PassengerWithMeta) => void;
  lang: string | undefined;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);

  const pendingArrivals = passengers
    .filter((p) => p.flights.some((f) => f.direction === 'arrival') && !arrived.has(p.id))
    .sort((a, b) => {
      const fa = a.flights.find((f) => f.direction === 'arrival')?.flight_datetime ?? '';
      const fb = b.flights.find((f) => f.direction === 'arrival')?.flight_datetime ?? '';
      return fa.localeCompare(fb);
    })
    .slice(0, 8);

  const upcomingSessions = sessions
    .filter((s) => (isoDate(s.starts_at) || '9999') >= today)
    .slice(0, 4);

  const arrivedCount = passengers.filter((p) => arrived.has(p.id)).length;

  return (
    <div className="space-y-5">
      {event && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-lg font-semibold">{event.name}</div>
          <div className="text-sm text-slate-500">
            {event.start_date}{event.end_date ? ` → ${event.end_date}` : ''}
            {event.destinations.length ? ` · ${event.destinations.join(', ')}` : ''}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('events.passengers')} value={passengers.length} />
        <Stat label="VIP" value={vipCount} />
        <Stat label={t('coordinator.arrivedCount')} value={`${arrivedCount}/${passengers.length}`} />
        <Stat label={t('coordinator.openIncidents')} value={openIncidents} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('coordinator.pendingArrivals')}</h2>
        {pendingArrivals.length === 0 ? (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm text-green-700">{t('coordinator.allArrived')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {pendingArrivals.map((p) => {
              const f = p.flights.find((x) => x.direction === 'arrival');
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {p.full_name}
                      {p.is_vip && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {[f?.airline, f?.flight_number].filter(Boolean).join(' ')} · {dm(f?.flight_datetime ?? null)} {isoTime(f?.flight_datetime ?? null)}
                      {f?.terminal ? ` · ${f.terminal}` : ''}
                    </div>
                  </div>
                  <ArrivedToggle on={false} onClick={() => onToggleArrived(p)} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('coordinator.nextSessions')}</h2>
        {upcomingSessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">{t('agenda.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {upcomingSessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="w-16 shrink-0 text-sm">
                  <div className="text-xs text-slate-400">{s.starts_at ? new Date(`${isoDate(s.starts_at)}T00:00:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric' }) : ''}</div>
                  <div className="font-medium text-slate-700">{isoTime(s.starts_at)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  {s.location && <div className="truncate text-xs text-slate-400">{s.location}</div>}
                </div>
                {s.session_type && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${typeChip[s.session_type]}`}>{t(`agenda.types.${s.session_type}`)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="text-2xl font-semibold text-brand">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function PasajerosTab({
  passengers,
  arrived,
  onToggleArrived,
}: {
  passengers: PassengerWithMeta[];
  arrived: Set<string>;
  onToggleArrived: (p: PassengerWithMeta) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const filtered = passengers
    .filter((p) => p.full_name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div>
      <input
        className={`${inputClass} mb-3`}
        placeholder={t('coordinator.searchPassenger')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mb-2 text-xs text-slate-500">{t('coordinator.arrivedCount')}: {passengers.filter((p) => arrived.has(p.id)).length}/{passengers.length}</div>
      {filtered.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('passengers.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">
                    {p.full_name}
                    {p.is_vip && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.hotel?.name ?? '—'}{p.room_number ? ` · ${t('passengers.form.roomNumber')} ${p.room_number}` : ''}
                  </div>
                </div>
                <ArrivedToggle on={arrived.has(p.id)} onClick={() => onToggleArrived(p)} />
              </div>
              {(p.dietary || p.allergies || p.special_needs) && (
                <div className="mt-1.5 flex flex-wrap gap-1">{reqChips(p)}</div>
              )}
              <div className="mt-2">{contactButtons(p, t('coordinator.call'))}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FuncionesTab({ sessions, eventId, lang }: { sessions: SessionWithMeta[]; eventId: string; lang: string | undefined }) {
  const { t } = useTranslation();
  const days = useMemo(() => {
    const map = new Map<string, SessionWithMeta[]>();
    for (const s of sessions) {
      const key = isoDate(s.starts_at) || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [sessions]);

  return (
    <div>
      <div className="mb-3 text-right">
        <Link to={`/events/${eventId}/agenda`} className="text-sm text-brand-accent hover:underline">{t('coordinator.fullAgenda')} →</Link>
      </div>
      {sessions.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('agenda.empty')}</p>
      ) : (
        <div className="space-y-5">
          {days.map(([key, items]) => (
            <div key={key}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {key === '—' ? t('agenda.noDate') : new Date(`${key}T00:00:00`).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <ul className="space-y-2">
                {items.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="w-14 shrink-0 text-sm font-medium text-slate-700">{isoTime(s.starts_at) || '—'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="truncate text-xs text-slate-400">
                        {s.location}
                        {s.location && s.attendee_count > 0 ? ' · ' : ''}
                        {s.attendee_count > 0 ? t('agenda.attendees', { count: s.attendee_count }) : ''}
                      </div>
                    </div>
                    {s.session_type && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${typeChip[s.session_type]}`}>{t(`agenda.types.${s.session_type}`)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LocalPassengersSection({ passengers, onSelectPassenger }: { passengers: PassengerWithMeta[]; onSelectPassenger: (p: PassengerWithMeta) => void }) {
  const { t } = useTranslation();
  const locals = passengers.filter((p) => p.is_local_transfer);
  if (locals.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('coordinator.localTransferLabel')}</h2>
      <ul className="divide-y divide-slate-100 rounded-lg border border-violet-200 bg-violet-50">
        {locals.map((p) => (
          <li key={p.id} className="flex items-start gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <button onClick={() => onSelectPassenger(p)} className="font-semibold text-brand hover:underline text-left">{p.full_name}</button>
              {p.is_vip && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
              <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                {p.origin_address && (
                  <div>
                    📍 {p.origin_address}{' '}
                    <a href={googleMapsUrl(p.origin_address)} target="_blank" rel="noopener" className="text-blue-700 underline">{t('coordinator.viewMap')}</a>
                  </div>
                )}
                {p.destination_address && (
                  <div>
                    🏁 {p.destination_address}{' '}
                    <a href={googleMapsUrl(p.destination_address)} target="_blank" rel="noopener" className="text-blue-700 underline">{t('coordinator.viewMap')}</a>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecepcionTab({
  passengers,
  arrived,
  onToggleArrived,
  onSelectPassenger,
}: {
  passengers: PassengerWithMeta[];
  arrived: Set<string>;
  onToggleArrived: (p: PassengerWithMeta) => void;
  onSelectPassenger: (p: PassengerWithMeta) => void;
}) {

  const arrivals = passengers
    .map((p) => ({ p, f: p.flights.find((x) => x.direction === 'arrival') }))
    .filter((x) => x.f)
    .sort((a, b) => (a.f!.flight_datetime ?? '').localeCompare(b.f!.flight_datetime ?? ''));

  const notArrived = arrivals.filter(({ p }) => !arrived.has(p.id));
  const alreadyArrived = arrivals.filter(({ p }) => arrived.has(p.id));

  return (
    <div className="space-y-5">
      <LocalPassengersSection passengers={passengers} onSelectPassenger={onSelectPassenger} />
      {notArrived.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Pendientes de recepcionar</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {notArrived.map(({ p, f }) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <button onClick={() => onSelectPassenger(p)} className="font-semibold text-brand hover:underline text-left">{p.full_name}</button>
                    {p.is_vip && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <div>✈️ {[f!.airline, f!.flight_number].filter(Boolean).join(' ')}</div>
                    <div>📍 {dm(f!.flight_datetime)} a las {isoTime(f!.flight_datetime)}{f!.terminal ? ` (Terminal ${f!.terminal})` : ''}</div>
                    <div>🏨 {p.hotel?.name ?? 'Sin hotel'}{p.room_number ? ` · Hab. ${p.room_number}` : ''}</div>
                    {f!.flight_number && (
                      <a href={flightStatusUrl(f!.flight_number)} target="_blank" rel="noopener" className="inline-block text-blue-700 underline">Consultar estado del vuelo</a>
                    )}
                  </div>
                  {(p.dietary || p.allergies || p.special_needs) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">{reqChips(p)}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <ArrivedToggle on={false} onClick={() => onToggleArrived(p)} />
                  {p.phone && (
                    <div className="flex gap-1">
                      <a href={telHref(p.phone)} className="text-xs rounded bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200">📞</a>
                      <a href={waHref(p.phone)} target="_blank" rel="noopener" className="text-xs rounded bg-green-50 px-2 py-1 text-green-700 hover:bg-green-100">💬</a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alreadyArrived.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ya recepcionados ({alreadyArrived.length})</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-green-200 bg-green-50">
            {alreadyArrived.map(({ p, f }) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="text-green-600">✓</span>
                <div className="min-w-0 flex-1 text-sm">
                  <button onClick={() => onSelectPassenger(p)} className="font-medium text-brand hover:underline text-left">{p.full_name}</button>
                  <div className="text-xs text-green-600">{dm(f!.flight_datetime)} {isoTime(f!.flight_datetime)}</div>
                </div>
                <button onClick={() => onToggleArrived(p)} className="text-xs text-green-600 hover:underline">Desmarcar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {arrivals.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">No hay vuelos de llegada</p>
      )}
    </div>
  );
}

function DespachoTab({
  passengers,
  onSelectPassenger,
}: {
  passengers: PassengerWithMeta[];
  onSelectPassenger: (p: PassengerWithMeta) => void;
}) {
  const { t } = useTranslation();

  const departures = passengers
    .map((p) => ({ p, f: p.flights.find((x) => x.direction === 'departure') }))
    .filter((x) => x.f)
    .sort((a, b) => (a.f!.flight_datetime ?? '').localeCompare(b.f!.flight_datetime ?? ''));

  return (
    <div className="space-y-5">
      <LocalPassengersSection passengers={passengers} onSelectPassenger={onSelectPassenger} />
      {departures.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500">No hay vuelos de salida</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {departures.map(({ p, f }) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-3">
              <div className="w-20 shrink-0 text-sm">
                <div className="text-xs text-slate-400">{dm(f!.flight_datetime)}</div>
                <div className="font-semibold text-slate-700">{isoTime(f!.flight_datetime)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <button onClick={() => onSelectPassenger(p)} className="font-medium text-brand hover:underline text-left">{p.full_name}</button>
                <div className="text-xs text-slate-500">
                  {f!.pickup_time && <div>🚐 {t('coordinator.hotelPickup')}: {dm(f!.pickup_time)} {isoTime(f!.pickup_time)}</div>}
                  <div>
                    {[f!.airline, f!.flight_number].filter(Boolean).join(' ')}{f!.terminal ? ` · Terminal ${f!.terminal}` : ''}
                  </div>
                  {f!.flight_number && (
                    <a href={flightStatusUrl(f!.flight_number)} target="_blank" rel="noopener" className="inline-block text-blue-700 underline">
                      {t('coordinator.checkFlightStatus')}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IncidenciasTab({
  agencyId,
  eventId,
  authorName,
  passengers,
  incidents,
  onChanged,
}: {
  agencyId: string;
  eventId: string;
  authorName: string | null;
  passengers: PassengerWithMeta[];
  incidents: Incident[];
  onChanged: (list: Incident[]) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('info');
  const [passengerId, setPassengerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: string | null) => (id ? passengers.find((p) => p.id === id)?.full_name ?? '' : '');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !agencyId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createIncident(agencyId, eventId, {
        title: title.trim(),
        detail: detail.trim() || null,
        severity,
        passenger_id: passengerId || null,
        created_by: authorName,
      });
      onChanged([created, ...incidents]);
      setTitle('');
      setDetail('');
      setSeverity('info');
      setPassengerId('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(inc: Incident) {
    try {
      await setIncidentResolved(inc.id, !inc.resolved);
      onChanged(incidents.map((x) => (x.id === inc.id ? { ...x, resolved: !inc.resolved } : x)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(inc: Incident) {
    if (!window.confirm(t('coordinator.confirmDeleteIncident'))) return;
    try {
      await deleteIncident(inc.id);
      onChanged(incidents.filter((x) => x.id !== inc.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const SEVS: IncidentSeverity[] = ['info', 'warning', 'urgent'];

  return (
    <div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={add} className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <input className={inputClass} placeholder={t('coordinator.incidentTitle')} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-2">
          <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
            {SEVS.map((s) => (
              <option key={s} value={s}>{t(`coordinator.severity.${s}`)}</option>
            ))}
          </select>
          <select className={inputClass} value={passengerId} onChange={(e) => setPassengerId(e.target.value)}>
            <option value="">{t('coordinator.noPassenger')}</option>
            {passengers.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
        <textarea className={inputClass} rows={2} placeholder={t('coordinator.incidentDetail')} value={detail} onChange={(e) => setDetail(e.target.value)} />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('coordinator.addIncident')}</Button>
        </div>
      </form>

      {incidents.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('coordinator.noIncidents')}</p>
      ) : (
        <ul className="space-y-2">
          {incidents.map((inc) => (
            <li key={inc.id} className={`rounded-lg border bg-white p-3 ${inc.resolved ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${sevStyle[inc.severity]}`}>
                  {t(`coordinator.severity.${inc.severity}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${inc.resolved ? 'line-through text-slate-400' : ''}`}>{inc.title}</div>
                  {inc.detail && <div className="text-xs text-slate-500">{inc.detail}</div>}
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {nameOf(inc.passenger_id) && <span>{nameOf(inc.passenger_id)} · </span>}
                    {inc.created_by && <span>{inc.created_by} · </span>}
                    {dm(inc.created_at)} {isoTime(inc.created_at)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => toggle(inc)}>
                  {inc.resolved ? t('coordinator.reopen') : t('coordinator.resolve')}
                </Button>
                <Button variant="ghost" className="text-red-600" onClick={() => remove(inc)}>{t('common.delete')}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
