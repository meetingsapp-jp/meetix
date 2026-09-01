import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import { inputClass } from '../../components/ui/Field';
import { listAssignedEventIds, listEvents } from '../../data/events';
import { listPassengers, setDepartureChecklist } from '../../data/passengers';
import { listSessions } from '../../data/sessions';
import {
  addEventNote,
  createIncident,
  deleteEventNote,
  deleteIncident,
  listArrivedIds,
  listEventMessages,
  listEventNotes,
  listIncidents,
  sendEventMessage,
  setArrived,
  setIncidentResolved,
  type EventMessage,
  type EventNote,
  type Incident,
  type IncidentSeverity,
} from '../../data/coordinator';
import type { EventWithMeta, PassengerWithMeta, SessionType, SessionWithMeta } from '../../types';
import PassengerTransportModal from './PassengerTransportModal';
import { flightStatusUrl, googleMapsUrl } from '../../lib/links';
import { listAuditLog, logAudit, type AuditEntry } from '../../data/audit';
import { enqueueArrival, flushArrivalQueue, getQueuedArrivals } from '../../lib/offlineQueue';

type Tab = 'today' | 'recepcion' | 'despacho' | 'funciones' | 'pasajeros' | 'incidencias' | 'notas' | 'chat' | 'historial';

const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const isoTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');
const dm = (iso: string | null) => {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};
const telHref = (phone: string | null) => `tel:${(phone ?? '').replace(/[^\d+]/g, '')}`;
const waHref = (phone: string | null) => `https://wa.me/${(phone ?? '').replace(/[^\d]/g, '')}`;

const locationLabel = (loc: string | null, t: (key: string) => string) =>
  loc === 'aeropuerto' ? t('passengers.form.locationAirport') : loc === 'hotel' ? t('passengers.form.locationHotel') : loc === 'otro' ? t('passengers.form.locationOther') : null;

function ReceptionSummary({ p, t, onEdit }: { p: PassengerWithMeta; t: (key: string) => string; onEdit?: (p: PassengerWithMeta) => void }) {
  const loc = locationLabel(p.reception_location, t);
  const hasAny = loc || p.reception_by || p.reception_sign_text;
  if (!hasAny) {
    return onEdit ? (
      <button type="button" onClick={() => onEdit(p)} className="text-left text-amber-600 underline decoration-dotted hover:text-amber-700">
        ⚠️ {t('coordinator.receptionUndefined')}
      </button>
    ) : (
      <div className="text-amber-600">⚠️ {t('coordinator.receptionUndefined')}</div>
    );
  }
  const content = (
    <div className="space-y-0.5">
      <div className="font-medium text-slate-700 dark:text-slate-200">
        📥 {[loc, p.reception_by].filter(Boolean).join(' · ')}
      </div>
      {p.reception_sign_text && <div className="text-slate-600 dark:text-slate-300">🪧 {p.reception_sign_text}</div>}
    </div>
  );
  return onEdit ? (
    <button type="button" onClick={() => onEdit(p)} className="text-left hover:opacity-80">{content}</button>
  ) : content;
}

function DispatchSummary({ p, t, onEdit }: { p: PassengerWithMeta; t: (key: string) => string; onEdit?: (p: PassengerWithMeta) => void }) {
  const loc = locationLabel(p.dispatch_location, t);
  const hasAny = loc || p.dispatch_by;
  if (!hasAny) {
    return onEdit ? (
      <button type="button" onClick={() => onEdit(p)} className="text-left text-amber-600 underline decoration-dotted hover:text-amber-700">
        ⚠️ {t('coordinator.dispatchUndefined')}
      </button>
    ) : (
      <div className="text-amber-600">⚠️ {t('coordinator.dispatchUndefined')}</div>
    );
  }
  const content = (
    <div className="font-medium text-slate-700 dark:text-slate-200">
      📤 {[loc, p.dispatch_by].filter(Boolean).join(' · ')}
    </div>
  );
  return onEdit ? (
    <button type="button" onClick={() => onEdit(p)} className="text-left hover:opacity-80">{content}</button>
  ) : content;
}

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
  const [pendingSync, setPendingSync] = useState(0);

  // Sync any arrivals queued while offline, on load / reconnect / tab focus.
  useEffect(() => {
    setPendingSync(getQueuedArrivals().length);
    const trySync = async () => {
      if (!navigator.onLine) return;
      const { remaining } = await flushArrivalQueue();
      setPendingSync(remaining);
      if (remaining === 0) load();
    };
    trySync();
    window.addEventListener('online', trySync);
    document.addEventListener('visibilitychange', trySync);
    return () => {
      window.removeEventListener('online', trySync);
      document.removeEventListener('visibilitychange', trySync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

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

  const toggleChecklistItem = useCallback(
    async (p: PassengerWithMeta, index: number) => {
      const items = p.departure_checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
      setPassengers((prev) => prev.map((x) => (x.id === p.id ? { ...x, departure_checklist: items } : x)));
      try {
        await setDepartureChecklist(p.id, items);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [],
  );

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

    // Offline (no signal at the airport, etc.): queue it locally and sync
    // automatically once connectivity is back, instead of showing an error.
    if (!navigator.onLine) {
      enqueueArrival({ agencyId: agency.id, passengerId: p.id, passengerName: p.full_name, arrived: next });
      setPendingSync(getQueuedArrivals().length);
      return;
    }

    try {
      await setArrived(agency.id, p.id, next);
      logAudit({
        agencyId: agency.id,
        eventId,
        actorId: appUser?.id ?? null,
        actorName: appUser?.full_name ?? null,
        action: next ? 'arrived' : 'unarrived',
        entityType: 'passenger',
        entityLabel: p.full_name,
      });
    } catch {
      // Likely a network failure that navigator.onLine didn't catch — queue
      // it too rather than losing the coordinator's action.
      enqueueArrival({ agencyId: agency.id, passengerId: p.id, passengerName: p.full_name, arrived: next });
      setPendingSync(getQueuedArrivals().length);
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
    { id: 'notas', label: t('coordinator.tabs.notes') },
    { id: 'chat', label: t('coordinator.tabs.chat') },
    { id: 'historial', label: t('coordinator.tabs.history') },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{t('coordinator.title')}</h1>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{t('coordinator.onsite')}</span>
        {pendingSync > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            🔄 {t('coordinator.pendingSync', { count: pendingSync })}
          </span>
        )}
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
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === tb.id ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
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
                <DespachoTab passengers={passengers} onSelectPassenger={setSelectedPassenger} onToggleChecklistItem={toggleChecklistItem} />
              )}
              {tab === 'funciones' && <FuncionesTab sessions={sessions} eventId={eventId} lang={i18n.resolvedLanguage} />}
              {tab === 'pasajeros' && (
                <PasajerosTab passengers={passengers} arrived={arrived} onToggleArrived={toggleArrived} onSelectPassenger={setSelectedPassenger} />
              )}
              {tab === 'incidencias' && (
                <IncidenciasTab
                  agencyId={agency?.id ?? ''}
                  eventId={eventId}
                  authorId={appUser?.id ?? null}
                  authorName={appUser?.full_name ?? null}
                  passengers={passengers}
                  incidents={incidents}
                  onChanged={setIncidents}
                />
              )}
              {tab === 'notas' && (
                <NotasTab
                  agencyId={agency?.id ?? ''}
                  eventId={eventId}
                  authorId={appUser?.id ?? null}
                  authorName={appUser?.full_name ?? null}
                />
              )}
              {tab === 'chat' && (
                <ChatTab
                  agencyId={agency?.id ?? ''}
                  eventId={eventId}
                  authorId={appUser?.id ?? null}
                  authorName={appUser?.full_name ?? null}
                />
              )}
              {tab === 'historial' && (
                <HistorialTab agencyId={agency?.id ?? ''} eventId={eventId} />
              )}
            </>
          )}
        </>
      )}

      <PassengerTransportModal
        open={selectedPassenger !== null}
        passenger={selectedPassenger}
        onClose={() => setSelectedPassenger(null)}
        onUpdate={(id, patch) => {
          setPassengers((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
          setSelectedPassenger((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
        }}
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

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const happeningNow = sessions.filter((s) => {
    if (!s.starts_at || !s.ends_at) return false;
    const start = new Date(s.starts_at).getTime();
    const end = new Date(s.ends_at).getTime();
    return start <= now && now <= end;
  });

  const pendingArrivals = passengers
    .filter((p) => p.flights.some((f) => f.direction === 'arrival') && !arrived.has(p.id))
    .sort((a, b) => {
      const fa = a.flights.find((f) => f.direction === 'arrival')?.flight_datetime ?? '';
      const fb = b.flights.find((f) => f.direction === 'arrival')?.flight_datetime ?? '';
      return fa.localeCompare(fb);
    })
    .slice(0, 8);

  const upcomingSessions = sessions
    .filter((s) => (isoDate(s.starts_at) || '9999') >= today && !happeningNow.includes(s))
    .slice(0, 4);

  const arrivedCount = passengers.filter((p) => arrived.has(p.id)).length;
  const missingReception = passengers.filter(
    (p) => !arrived.has(p.id) && !p.reception_location && !p.reception_by && !p.reception_sign_text,
  ).length;
  const missingDispatch = passengers.filter((p) => !p.dispatch_location && !p.dispatch_by).length;

  return (
    <div className="space-y-5">
      {event && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            {event.welcome_sign_url && (
              <a href={event.welcome_sign_url} target="_blank" rel="noopener" className="shrink-0">
                <img src={event.welcome_sign_url} alt={t('events.form.welcomeSign')} className="h-16 w-24 rounded border border-slate-200 object-cover" />
              </a>
            )}
            <div className="min-w-0">
              <div className="text-lg font-semibold">{event.name}</div>
              <div className="text-sm text-slate-500">
                {event.start_date}{event.end_date ? ` → ${event.end_date}` : ''}
                {event.destinations.length ? ` · ${event.destinations.join(', ')}` : ''}
              </div>
              {event.welcome_sign_url && (
                <a href={event.welcome_sign_url} target="_blank" rel="noopener" className="mt-1 inline-block text-xs text-blue-700 underline">
                  {t('events.form.welcomeSign')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('events.passengers')} value={passengers.length} />
        <Stat label="VIP" value={vipCount} />
        <Stat label={t('coordinator.arrivedCount')} value={`${arrivedCount}/${passengers.length}`} />
        <Stat label={t('coordinator.openIncidents')} value={openIncidents} />
      </div>

      {(missingReception > 0 || missingDispatch > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="mb-1 font-semibold">⚠️ {t('coordinator.alerts')}</div>
          <ul className="space-y-0.5">
            {missingReception > 0 && <li>{t('coordinator.alertMissingReception', { count: missingReception })}</li>}
            {missingDispatch > 0 && <li>{t('coordinator.alertMissingDispatch', { count: missingDispatch })}</li>}
          </ul>
        </div>
      )}

      {happeningNow.length > 0 && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">{t('coordinator.happeningNow')}</h2>
          </div>
          <ul className="space-y-2">
            {happeningNow.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
                <div className="w-16 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {isoTime(s.starts_at)}–{isoTime(s.ends_at)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  {s.location && <div className="truncate text-xs text-slate-400">{s.location}</div>}
                </div>
                {s.session_type && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${typeChip[s.session_type]}`}>{t(`agenda.types.${s.session_type}`)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

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
  onSelectPassenger,
}: {
  passengers: PassengerWithMeta[];
  arrived: Set<string>;
  onToggleArrived: (p: PassengerWithMeta) => void;
  onSelectPassenger: (p: PassengerWithMeta) => void;
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
                    <button onClick={() => onSelectPassenger(p)} className="text-left text-brand hover:underline">{p.full_name}</button>
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
      <ul className="space-y-2">
        {locals.map((p) => (
          <li key={p.id} className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 shadow-sm dark:border-violet-800 dark:bg-violet-950/20">
            <div className="flex items-start gap-3">
              {p.photo_url && <img src={p.photo_url} alt={p.full_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <button onClick={() => onSelectPassenger(p)} className="font-semibold text-brand hover:underline text-left">{p.full_name}</button>
                  {p.is_vip && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
                </div>
                {p.local_transfer_time && (
                  <div className="mt-1 text-xs font-medium text-violet-800 dark:text-violet-300">🕐 {dm(p.local_transfer_time)} {isoTime(p.local_transfer_time)}</div>
                )}
                <div className="mt-0.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
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
                  <div className={p.transport_provider ? 'font-medium text-slate-700 dark:text-slate-200' : 'text-amber-600'}>
                    🚐 {p.transport_provider?.name ?? 'Sin proveedor asignado'}
                  </div>
                  <ReceptionSummary p={p} t={t} onEdit={onSelectPassenger} />
                  {p.reception_notes && <div>{p.reception_notes}</div>}
                  <DispatchSummary p={p} t={t} onEdit={onSelectPassenger} />
                  {p.dispatch_notes && <div>{p.dispatch_notes}</div>}
                </div>
              </div>
              {p.transport_provider?.contact_phone && (
                <div className="flex shrink-0 flex-col gap-1">
                  <a href={telHref(p.transport_provider.contact_phone)} className="text-xs rounded bg-white px-2 py-1 text-violet-700 hover:bg-violet-100" title="Llamar proveedor">🚐📞</a>
                  <a href={waHref(p.transport_provider.contact_phone)} target="_blank" rel="noopener" className="text-xs rounded bg-white px-2 py-1 text-violet-700 hover:bg-violet-100" title="WhatsApp proveedor">🚐💬</a>
                </div>
              )}
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
  const { t } = useTranslation();

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
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
            {notArrived.map(({ p, f }) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                {p.photo_url && (
                  <img src={p.photo_url} alt={p.full_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <button onClick={() => onSelectPassenger(p)} className="font-semibold text-brand hover:underline text-left">{p.full_name}</button>
                    {p.is_vip && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <div>✈️ {[f!.airline, f!.flight_number].filter(Boolean).join(' ')}</div>
                    <div>📍 {dm(f!.flight_datetime)} a las {isoTime(f!.flight_datetime)}{f!.terminal ? ` (Terminal ${f!.terminal})` : ''}</div>
                    <div>🏨 {p.hotel?.name ?? 'Sin hotel'}{p.room_number ? ` · Hab. ${p.room_number}` : ''}</div>
                    <div className={p.transport_provider ? 'font-medium text-slate-700' : 'text-amber-600'}>
                      🚐 {p.transport_provider?.name ?? 'Sin proveedor asignado'}
                    </div>
                    <ReceptionSummary p={p} t={t} onEdit={onSelectPassenger} />
                    {p.reception_notes && <div>{p.reception_notes}</div>}
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
                  {p.transport_provider?.contact_phone && (
                    <div className="flex gap-1">
                      <a href={telHref(p.transport_provider.contact_phone)} className="text-xs rounded bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100" title="Llamar proveedor">🚐📞</a>
                      <a href={waHref(p.transport_provider.contact_phone)} target="_blank" rel="noopener" className="text-xs rounded bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100" title="WhatsApp proveedor">🚐💬</a>
                    </div>
                  )}
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
  onToggleChecklistItem,
}: {
  passengers: PassengerWithMeta[];
  onSelectPassenger: (p: PassengerWithMeta) => void;
  onToggleChecklistItem: (p: PassengerWithMeta, index: number) => void;
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
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {departures.map(({ p, f }) => (
            <li key={p.id} className="flex items-start gap-3 px-3 py-3">
              <div className="w-20 shrink-0 text-sm">
                <div className="text-xs text-slate-400">{dm(f!.flight_datetime)}</div>
                <div className="font-semibold text-slate-700">{isoTime(f!.flight_datetime)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <button onClick={() => onSelectPassenger(p)} className="font-medium text-brand hover:underline text-left">{p.full_name}</button>
                <div className="text-xs text-slate-500">
                  {f!.pickup_time && <div>🚐 {t('coordinator.hotelPickup')}: {dm(f!.pickup_time)} {isoTime(f!.pickup_time)}</div>}
                  <div>
                    ✈️ {[f!.airline, f!.flight_number].filter(Boolean).join(' ')} · {dm(f!.flight_datetime)} {isoTime(f!.flight_datetime)}{f!.terminal ? ` · Terminal ${f!.terminal}` : ''}
                  </div>
                  <div className={p.transport_provider ? 'font-medium text-slate-700' : 'text-amber-600'}>
                    🚐 {p.transport_provider?.name ?? 'Sin proveedor asignado'}
                  </div>
                  <DispatchSummary p={p} t={t} onEdit={onSelectPassenger} />
                  {p.dispatch_notes && <div>{p.dispatch_notes}</div>}
                  {f!.flight_number && (
                    <a href={flightStatusUrl(f!.flight_number)} target="_blank" rel="noopener" className="inline-block text-blue-700 underline">
                      {t('coordinator.checkFlightStatus')}
                    </a>
                  )}
                </div>
                {p.departure_checklist.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {p.departure_checklist.map((item, idx) => (
                      <li key={idx}>
                        <label className={'flex items-center gap-1.5 text-xs cursor-pointer ' + (item.done ? 'text-slate-400 line-through' : 'text-slate-600')}>
                          <input type="checkbox" checked={item.done} onChange={() => onToggleChecklistItem(p, idx)} className="h-3.5 w-3.5 rounded border-slate-300" />
                          {item.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {p.transport_provider?.contact_phone && (
                <div className="flex shrink-0 flex-col gap-1">
                  <a href={telHref(p.transport_provider.contact_phone)} className="text-xs rounded bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100" title="Llamar proveedor">🚐📞</a>
                  <a href={waHref(p.transport_provider.contact_phone)} target="_blank" rel="noopener" className="text-xs rounded bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100" title="WhatsApp proveedor">🚐💬</a>
                </div>
              )}
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
  authorId,
  authorName,
  passengers,
  incidents,
  onChanged,
}: {
  agencyId: string;
  eventId: string;
  authorId: string | null;
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
      logAudit({
        agencyId, eventId, actorId: authorId, actorName: authorName,
        action: 'create_incident', entityType: 'incident', entityLabel: created.title,
      });
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
      logAudit({
        agencyId, eventId, actorId: authorId, actorName: authorName,
        action: inc.resolved ? 'reopen_incident' : 'resolve_incident', entityType: 'incident', entityLabel: inc.title,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(inc: Incident) {
    if (!window.confirm(t('coordinator.confirmDeleteIncident'))) return;
    try {
      await deleteIncident(inc.id);
      onChanged(incidents.filter((x) => x.id !== inc.id));
      logAudit({
        agencyId, eventId, actorId: authorId, actorName: authorName,
        action: 'delete_incident', entityType: 'incident', entityLabel: inc.title,
      });
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

function NotasTab({
  agencyId,
  eventId,
  authorId,
  authorName,
}: {
  agencyId: string;
  eventId: string;
  authorId: string | null;
  authorName: string | null;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listEventNotes(eventId)
      .then(setNotes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !agencyId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addEventNote(agencyId, eventId, authorId, authorName, body.trim());
      setNotes((prev) => [created, ...prev]);
      setBody('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteEventNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function emailNotes() {
    const subject = t('coordinator.notesEmailSubject');
    const emailBody = notes
      .map((n) => `${dm(n.created_at)} ${isoTime(n.created_at)} — ${n.author_name ?? ''}\n${n.body}`)
      .join('\n\n');
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
  }

  return (
    <div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={add} className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <textarea
          className={inputClass}
          rows={2}
          placeholder={t('coordinator.notePlaceholder')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          {notes.length > 0 && (
            <Button type="button" variant="ghost" onClick={emailNotes}>{t('coordinator.emailNotes')}</Button>
          )}
          <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('coordinator.addNote')}</Button>
        </div>
      </form>

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : notes.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('coordinator.noNotes')}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="whitespace-pre-wrap text-sm">{n.body}</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>{n.author_name ? `${n.author_name} · ` : ''}{dm(n.created_at)} {isoTime(n.created_at)}</span>
                <button onClick={() => remove(n.id)} className="text-red-500 hover:underline">{t('common.delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatTab({
  agencyId,
  eventId,
  authorId,
  authorName,
}: {
  agencyId: string;
  eventId: string;
  authorId: string | null;
  authorName: string | null;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    listEventMessages(eventId)
      .then(setMessages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !eventId) return;
    const channel = supabase
      .channel(`event-chat:${eventId}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [eventId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !agencyId) return;
    setSending(true);
    setError(null);
    const text = body.trim();
    setBody('');
    try {
      await sendEventMessage(agencyId, eventId, authorId, authorName, text);
      load();
    } catch (err) {
      setError((err as Error).message);
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col">
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        {loading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('coordinator.noMessages')}</p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === authorId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-brand-accent text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  {!mine && <div className="mb-0.5 text-[11px] font-semibold opacity-70">{m.author_name ?? '—'}</div>}
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>{isoTime(m.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          className={`${inputClass} flex-1`}
          placeholder={t('coordinator.messagePlaceholder')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" disabled={sending || !body.trim()}>{t('coordinator.send')}</Button>
      </form>
    </div>
  );
}

const AUDIT_ICON: Record<string, string> = {
  arrived: '✅',
  unarrived: '↩️',
  create_incident: '⚠️',
  resolve_incident: '✔️',
  reopen_incident: '↩️',
  delete_incident: '🗑️',
  create_passenger: '➕',
  update_passenger: '✏️',
  delete_passenger: '🗑️',
  change_role: '🔑',
};

function HistorialTab({ agencyId, eventId }: { agencyId: string; eventId: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) return;
    setLoading(true);
    listAuditLog(agencyId, eventId)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agencyId, eventId]);

  if (loading) return <p className="text-slate-500">{t('common.loading')}</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (entries.length === 0) {
    return <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('coordinator.noHistory')}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
          <span className="shrink-0">{AUDIT_ICON[e.action] ?? '•'}</span>
          <div className="min-w-0 flex-1">
            <span>{t(`coordinator.auditAction.${e.action}`, { defaultValue: e.action })}</span>
            {e.entity_label && <span className="font-medium"> — {e.entity_label}</span>}
            {e.detail && <span className="text-slate-500"> ({e.detail})</span>}
            <div className="text-[11px] text-slate-400">
              {e.actor_name ? `${e.actor_name} · ` : ''}{dm(e.created_at)} {isoTime(e.created_at)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
