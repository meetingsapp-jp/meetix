import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import type { EventStatus, EventWithMeta } from '../../types';
import { listEvents } from '../../data/events';

const STATUSES: EventStatus[] = ['planificacion', 'confirmado', 'en_curso', 'finalizado', 'cancelado'];

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

export default function DashboardPage() {
  const { t } = useTranslation();
  const { agency, loading: agencyLoading } = useAgency();
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agency) return;
    setLoading(true);
    listEvents(agency.id)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agency]);

  const totals = useMemo(() => {
    const passengers = events.reduce((sum, e) => sum + e.passenger_count, 0);
    const byStatus = STATUSES.map((s) => ({ status: s, count: events.filter((e) => e.status === s).length }));
    const active = events.filter((e) => e.status !== 'finalizado' && e.status !== 'cancelado').length;
    return { passengers, byStatus, active };
  }, [events]);

  if (agencyLoading || loading) return <p className="text-slate-500">{t('common.loading')}</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t('dashboard.title')}</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('dashboard.totalEvents')} value={events.length} />
        <StatCard label={t('dashboard.activeEvents')} value={totals.active} />
        <StatCard label={t('dashboard.totalPassengers')} value={totals.passengers} />
        <StatCard label={t('dashboard.avgPassengers')} value={events.length ? Math.round(totals.passengers / events.length) : 0} />
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
