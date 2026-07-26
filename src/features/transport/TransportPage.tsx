import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import { useRole } from '../../auth/RoleContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import type { EventWithMeta, PassengerWithMeta, TransportProvider } from '../../types';
import { listEvents } from '../../data/events';
import { listPassengers, setPassengerVip } from '../../data/passengers';
import { createProvider, listProviders, setPassengerProvider } from '../../data/transport';
import { exportVipCsv, exportVipPdf, vipCount, type VipLabels } from '../../lib/export/vip';

type Filter = 'all' | 'vip' | 'group';

export default function TransportPage() {
  const { t } = useTranslation();
  const { agency } = useAgency();
  const { can } = useRole();

  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [eventId, setEventId] = useState('');
  const [passengers, setPassengers] = useState<PassengerWithMeta[]>([]);
  const [providers, setProviders] = useState<TransportProvider[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerModal, setProviderModal] = useState(false);

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

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [pax, prov] = await Promise.all([listPassengers(eventId), listProviders(eventId)]);
      setPassengers(pax);
      setProviders(prov);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) load();
  }, [eventId, load]);

  async function toggleVip(p: PassengerWithMeta) {
    try {
      await setPassengerVip(p.id, !p.is_vip);
      setPassengers((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_vip: !p.is_vip } : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function assignProvider(p: PassengerWithMeta, providerId: string) {
    try {
      await setPassengerProvider(p.id, providerId || null);
      const prov = providers.find((x) => x.id === providerId) ?? null;
      setPassengers((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, transport_provider_id: providerId || null, transport_provider: prov ? { name: prov.name } : null }
            : x,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const shown = passengers.filter((p) => (filter === 'all' ? true : filter === 'vip' ? p.is_vip : !p.is_vip));
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
    provider: t('transport.provider'),
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

        <div className="ml-auto flex flex-wrap gap-2">
          {can.managePassengers && eventId && (
            <Button variant="secondary" onClick={() => setProviderModal(true)}>{t('transport.providers')}</Button>
          )}
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
                    <th className="px-3 py-2">{t('transport.provider')}</th>
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
                      <td className="px-3 py-2">
                        {can.managePassengers ? (
                          <select
                            value={p.transport_provider_id ?? ''}
                            onChange={(e) => assignProvider(p, e.target.value)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">{t('transport.noProvider')}</option>
                            {providers.map((pr) => (
                              <option key={pr.id} value={pr.id}>{pr.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-600">{p.transport_provider?.name ?? '—'}</span>
                        )}
                      </td>
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

      <Modal open={providerModal} title={t('transport.providers')} onClose={() => setProviderModal(false)}>
        {agency && (
          <ProvidersPanel
            agencyId={agency.id}
            eventId={eventId}
            providers={providers}
            onChange={(list) => setProviders(list)}
          />
        )}
      </Modal>
    </div>
  );
}

function ProvidersPanel({
  agencyId,
  eventId,
  providers,
  onChange,
}: {
  agencyId: string;
  eventId: string;
  providers: TransportProvider[];
  onChange: (list: TransportProvider[]) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createProvider(agencyId, eventId, {
        name: name.trim(),
        contact_phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
      onChange([...providers, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setPhone('');
      setNotes('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {providers.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {providers.map((p) => (
            <li key={p.id} className="px-3 py-2 text-sm">
              <span className="font-medium">{p.name}</span>
              {p.contact_phone && <span className="text-slate-500"> · {p.contact_phone}</span>}
              {p.notes && <div className="text-xs text-slate-400">{p.notes}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{t('transport.noProviders')}</p>
      )}

      <form onSubmit={add} className="space-y-2 border-t border-slate-200 pt-3">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Field label={t('transport.providerName')}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('transport.providerPhone')}>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('transport.providerNotes')}>
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('transport.addProvider')}</Button>
        </div>
      </form>
    </div>
  );
}
