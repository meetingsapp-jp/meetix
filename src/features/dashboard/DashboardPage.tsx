import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import type { EventStatus, EventWithMeta } from '../../types';
import { listEvents } from '../../data/events';
import { listAgencyPassengers, type DashboardPassenger } from '../../data/dashboard';

const STATUSES: EventStatus[] = ['planificacion', 'confirmado', 'en_curso', 'finalizado', 'cancelado'];
const INACTIVE: EventStatus[] = ['finalizado', 'cancelado'];

const statusColors: Record<string, string> = {
  planificacion: 'bg-slate-200 text-slate-700',
  confirmado: 'bg-blue-100 text-blue-700',
  en_curso: 'bg-amber-100 text-amber-800',
  finalizado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-3xl font-semibold text-brand">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

// Format straight from the ISO string (no timezone shift): "dd/mm · HH:mm".
function fmtFlight(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-');
  const time = iso.slice(11, 16);
  return `${d}/${m}${time ? ` · ${time}` : ''}`;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { agency, loading: agencyLoading } = useAgency();
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [pax, setPax] = useState<DashboardPassenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agency) return;
    setLoading(true);
    Promise.all([listEvents(agency.id), listAgencyPassengers(agency.id)])
      .then(([ev, ps]) => {
        setEvents(ev);
        setPax(ps);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agency]);

  const totals = useMemo(() => {
    const passengers = events.reduce((sum, e) => sum + e.passenger_count, 0);
    const byStatus = STATUSES.map((s) => ({ status: s, count: events.filter((e) => e.status === s).length }));
    const active = events.filter((e) => !INACTIVE.includes(e.status)).length;
    const vip = pax.filter((p) => p.is_vip).length;
    return { passengers, byStatus, active, vip };
  }, [events, pax]);

  // Next flights across the agency (from now on), soonest first.
  const upcoming = useMemo(() => {
    const now = Date.now();
    const rows = pax.flatMap((p) =>
      p.flights
        .filter((f) => f.flight_datetime && new Date(f.flight_datetime).getTime() >= now)
        .map((f) => ({ passenger: p.full_name, event: p.event?.name ?? '', ...f })),
    );
    rows.sort((a, b) => new Date(a.flight_datetime!).getTime() - new Date(b.flight_datetime!).getTime());
    return rows.slice(0, 8);
  }, [pax]);

  // Data-quality alerts, only for passengers in active events.
  const alerts = useMemo(() => {
    const activePax = pax.filter((p) => p.event && !INACTIVE.includes(p.event.status));
    const noHotel = activePax.filter((p) => !p.hotel_id).length;
    const noRoom = activePax.filter((p) => p.hotel_id && !p.room_number).length;
    const noArrival = activePax.filter((p) => !p.flights.some((f) => f.direction === 'arrival')).length;
    return { noHotel, noRoom, noArrival };
  }, [pax]);

  if (agencyLoading || loading) return <p className="text-slate-500">{t('common.loading')}</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t('dashboard.title')}</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('dashboard.totalEvents')} value={events.length} />
        <StatCard label={t('dashboard.activeEvents')} value={totals.active} />
        <StatCard label={t('dashboard.totalPassengers')} value={totals.passengers} />
        <StatCard label={t('dashboard.vip')} value={totals.vip} />
      </div>

      {/* Live operations: upcoming flights + alerts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('dashboard.upcomingFlights')}
          </h2>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              {t('dashboard.noUpcoming')}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {upcoming.map((f, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className={f.direction === 'arrival' ? 'text-green-600' : 'text-blue-600'}>
                    {f.direction === 'arrival' ? '↓' : '↑'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.passenger}</div>
                    <div className="truncate text-xs text-slate-400">
                      {[f.airline, f.flight_number].filter(Boolean).join(' ')}
                      {f.event ? ` · ${f.event}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-slate-500">{fmtFlight(f.flight_datetime)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('dashboard.alerts')}
          </h2>
          {alerts.noHotel + alerts.noRoom + alerts.noArrival === 0 ? (
            <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">
              {t('dashboard.allGood')}
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.noArrival > 0 && (
                <AlertRow label={t('dashboard.alertNoArrival')} count={alerts.noArrival} />
              )}
              {alerts.noHotel > 0 && (
                <AlertRow label={t('dashboard.alertNoHotel')} count={alerts.noHotel} />
              )}
              {alerts.noRoom > 0 && (
                <AlertRow label={t('dashboard.alertNoRoom')} count={alerts.noRoom} />
              )}
            </ul>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.statusOverview')}</h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {totals.byStatus.map(({ status, count }) => (
          <span key={status} className={`rounded-full px-3 py-1 text-sm ${statusColors[status]}`}>
            {t(`events.status.${status}`)}: <strong>{count}</strong>
          </span>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.eventsList')}</h2>
      {events.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {t('events.empty')} <Link to="/events" className="text-brand-accent hover:underline">{t('events.new')}</Link>
        </p>
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">{t('events.form.name')}</th>
                <th className="px-3 py-2">{t('events.form.client')}</th>
                <th className="px-3 py-2">{t('events.dates')}</th>
                <th className="px-3 py-2">{t('events.passengers')}</th>
                <th className="px-3 py-2">{t('events.form.status')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{ev.name}</td>
                  <td className="px-3 py-2 text-slate-600">{ev.client?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {ev.start_date ?? '—'}{ev.end_date ? ` → ${ev.end_date}` : ''}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{ev.passenger_count}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[ev.status] ?? ''}`}>
                      {t(`events.status.${ev.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/events/${ev.id}/passengers`} className="text-brand-accent hover:underline">
                      {t('events.viewPassengers')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="space-y-2 md:hidden">
          {events.map((ev) => (
            <Link
              key={ev.id}
              to={`/events/${ev.id}/passengers`}
              className="block rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{ev.name}</div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusColors[ev.status] ?? ''}`}>
                  {t(`events.status.${ev.status}`)}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {ev.client?.name ?? '—'}
                {(ev.start_date || ev.end_date) ? (
                  <span> · {ev.start_date ?? ''}{ev.end_date ? ` → ${ev.end_date}` : ''}</span>
                ) : null}
                <span> · {t('events.passengers')}: {ev.passenger_count}</span>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

function AlertRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 font-semibold text-amber-800">
        {count}
      </span>
      <span className="text-amber-900">{label}</span>
    </li>
  );
}
