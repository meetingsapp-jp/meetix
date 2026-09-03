import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import { useRole } from '../../auth/RoleContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import type { EventWithMeta } from '../../types';
import { createEvent, deleteEvent, listEvents, setEventCoordinators, updateEvent, type EventInput } from '../../data/events';
import EventForm from './EventForm';
import Spinner from '../../components/ui/Spinner';
import { exportEventsCsv } from '../../lib/export/events';

const statusColors: Record<string, string> = {
  planificacion: 'bg-slate-200 text-slate-700',
  confirmado: 'bg-blue-100 text-blue-700',
  en_curso: 'bg-amber-100 text-amber-800',
  finalizado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
};

export default function EventsPage() {
  const { t } = useTranslation();
  const { agency, loading: agencyLoading, error: agencyError } = useAgency();
  const { can } = useRole();

  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventWithMeta | null>(null);

  const refresh = useCallback(async () => {
    if (!agency) return;
    setLoading(true);
    setError(null);
    try {
      setEvents(await listEvents(agency.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agency]);

  useEffect(() => {
    if (agency) refresh();
  }, [agency, refresh]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(ev: EventWithMeta) {
    setEditing(ev);
    setModalOpen(true);
  }

  async function handleSubmit(input: EventInput, coordinatorIds: string[]) {
    if (!agency) return;
    const ev = editing ? await updateEvent(editing.id, input) : await createEvent(agency.id, input);
    await setEventCoordinators(agency.id, ev.id, coordinatorIds);
    setModalOpen(false);
    await refresh();
  }

  async function handleDelete(ev: EventWithMeta) {
    if (!window.confirm(t('events.confirmDelete', { name: ev.name }))) return;
    try {
      await deleteEvent(ev.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (agencyLoading) return <Spinner />;
  if (agencyError || !agency)
    return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{t('common.noAgency')}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('events.title')}</h1>
        <div className="flex gap-2">
          {events.length > 0 && (
            <Button
              variant="secondary"
              onClick={() =>
                exportEventsCsv(agency.name, events, {
                  name: t('events.form.name'),
                  client: t('events.form.client'),
                  startDate: t('events.dates'),
                  endDate: t('events.form.endDate'),
                  destinations: t('events.form.destinations'),
                  passengers: t('events.passengers'),
                  status: t('events.form.status'),
                  statusLabel: (status) => t(`events.status.${status}`),
                })
              }
            >
              {t('events.export')}
            </Button>
          )}
          {can.manageEvents && <Button onClick={openCreate}>+ {t('events.new')}</Button>}
        </div>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {t('events.empty')}
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
                <th className="px-3 py-2">{t('events.form.destinations')}</th>
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
                  <td className="px-3 py-2 text-slate-600">{ev.destinations.join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{ev.passenger_count}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[ev.status] ?? ''}`}>
                      {t(`events.status.${ev.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <CopyClientPortalLink token={ev.client_access_token} />
                    <Link
                      to={`/events/${ev.id}/passengers`}
                      className="mr-1 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-slate-100"
                    >
                      {t('events.viewPassengers')}
                    </Link>
                    <Link
                      to={`/events/${ev.id}/agenda`}
                      className="mr-1 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-slate-100"
                    >
                      {t('agenda.title')}
                    </Link>
                    <Link
                      to={`/events/${ev.id}/checklist`}
                      className="mr-1 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-slate-100"
                    >
                      {t('checklist.title')}
                    </Link>
                    {can.manageEvents && (
                      <>
                        <Button variant="ghost" onClick={() => openEdit(ev)}>{t('common.edit')}</Button>
                        <Button variant="ghost" className="text-red-600" onClick={() => handleDelete(ev)}>
                          {t('common.delete')}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="space-y-2 md:hidden">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-lg border border-slate-200 bg-white p-3">
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
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {t('events.passengers')}: {ev.passenger_count}
                {ev.destinations.length ? ` · ${ev.destinations.join(', ')}` : ''}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyClientPortalLink token={ev.client_access_token} />
                <Link to={`/events/${ev.id}/passengers`} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-brand-accent">
                  {t('events.viewPassengers')}
                </Link>
                <Link to={`/events/${ev.id}/agenda`} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-brand-accent">
                  {t('agenda.title')}
                </Link>
                <Link to={`/events/${ev.id}/checklist`} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-brand-accent">
                  {t('checklist.title')}
                </Link>
                {can.manageEvents && (
                  <>
                    <Button variant="ghost" onClick={() => openEdit(ev)}>{t('common.edit')}</Button>
                    <Button variant="ghost" className="text-red-600" onClick={() => handleDelete(ev)}>{t('common.delete')}</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? t('events.editTitle') : t('events.new')}
        onClose={() => setModalOpen(false)}
      >
        <EventForm
          agencyId={agency.id}
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

// Copies the no-login portal link so the client can plan their own agenda.
function CopyClientPortalLink({ token }: { token: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/cliente/${token}`;
  return (
    <button
      type="button"
      className="mr-1 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-slate-100"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? t('admin.copied') : t('events.copyClientLink')}
    </button>
  );
}
