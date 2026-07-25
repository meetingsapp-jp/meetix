import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import { useRole } from '../../auth/RoleContext';
import Button from '../../components/ui/Button';
import { inputClass } from '../../components/ui/Field';
import type { EventWithMeta, PassengerWithMeta } from '../../types';
import { listEvents } from '../../data/events';
import { listPassengers, setPassengerVip } from '../../data/passengers';
import { exportVipCsv, exportVipPdf, vipCount, type VipLabels } from '../../lib/export/vip';

type Filter = 'all' | 'vip' | 'group';

export default function TransportPage() {
  const { t } = useTranslation();
  const { agency } = useAgency();
  const { can } = useRole();

  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [eventId, setEventId] = useState('');
  const [passengers, setPassengers] = useState<PassengerWithMeta[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agency) return;
    listEvents(agency.id)
      .then((evs) => {
        setEvents(evs);
        if (evs.length && !eventId) setEventId(evs[0].id);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency]);

  const loadPassengers = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      setPassengers(await listPassengers(eventId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) loadPassengers();
  }, [eventId, loadPassengers]);

  async function toggleVip(p: PassengerWithMeta) {
    try {
      await setPassengerVip(p.id, !p.is_vip);
      setPassengers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, is_vip: !p.is_vip } : x)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const shown = passengers.filter((p) =>
    filter === 'all' ? true : filter === 'vip' ? p.is_vip : !p.is_vip,
  );
  const nVip = vipCount(passengers);

  const labels: VipLabels = {
    title: t('transport.exportTitle'),
    event: t('events.title'),
    generated: t('transport.generated'),
    name: t('passengers.form.fullName'),
    arrival: t('passengers.form.arrival'),
    departure: t('passengers.form.departure'),
    hotel: t('passengers.form.hotel'),
    room: t('passengers.form.roomNumber'),
    phone: t('passengers.form.phone'),
  };

  const flightCell = (p: PassengerWithMeta, dir: 'arrival' | 'departure') => {
    const f = p.flights.find((x) => x.direction === dir);
    if (!f) return '—';
    const parts = [f.airline, f.flight_number].filter(Boolean).join(' ');
    const dt = f.flight_datetime ? new Date(f.flight_datetime).toLocaleString() : '';
    return `${parts}${dt ? ` · ${dt}` : ''}` || '—';
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">{t('transport.title')}</h1>
      <p className="mb-4 text-slate-600">{t('transport.subtitle')}</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${inputClass} max-w-xs`} value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">{t('transport.selectEvent')}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            disabled={!selectedEvent || nVip === 0}
            onClick={() => selectedEvent && exportVipCsv(selectedEvent, passengers, labels)}
          >
            {t('transport.exportCsv')}
          </Button>
          <Button
            disabled={!selectedEvent || nVip === 0}
            onClick={() => selectedEvent && exportVipPdf(selectedEvent, passengers, labels)}
          >
            {t('transport.exportPdf')}
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!eventId ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {t('transport.pickEventHint')}
        </p>
      ) : loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <>
          <div className="mb-3 flex gap-1">
            {(['all', 'vip', 'group'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-sm ${filter === f ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t(`transport.filter.${f}`)}
                {f === 'vip' && ` (${nVip})`}
                {f === 'group' && ` (${passengers.length - nVip})`}
                {f === 'all' && ` (${passengers.length})`}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
              {t('transport.emptyList')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">{t('passengers.form.fullName')}</th>
                    <th className="px-3 py-2">{t('passengers.form.arrival')}</th>
                    <th className="px-3 py-2">{t('passengers.form.departure')}</th>
                    <th className="px-3 py-2">{t('passengers.form.hotel')}</th>
                    <th className="px-3 py-2">{t('passengers.form.phone')}</th>
                    <th className="px-3 py-2">{t('passengers.transport')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{p.full_name}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{flightCell(p, 'arrival')}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{flightCell(p, 'departure')}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {p.hotel?.name ?? '—'}{p.room_number ? ` · ${p.room_number}` : ''}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{p.phone ?? '—'}</td>
                      <td className="px-3 py-2">
                        {can.managePassengers ? (
                          <button
                            onClick={() => toggleVip(p)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_vip ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
                            title={t('transport.toggleHint')}
                          >
                            {p.is_vip ? 'VIP' : t('passengers.group')}
                          </button>
                        ) : p.is_vip ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">VIP</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t('passengers.group')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
