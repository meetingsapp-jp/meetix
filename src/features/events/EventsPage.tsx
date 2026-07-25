import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import { useRole } from '../../auth/RoleContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import type { EventWithMeta } from '../../types';
import { createEvent, deleteEvent, listEvents, updateEvent, type EventInput } from '../../data/events';
import EventForm from './EventForm';

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

  async function handleSubmit(input: EventInput) {
    if (!agency) return;
    if (editing) await updateEvent(editing.id, input);
    else await createEvent(agency.id, input);
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

  if (agencyLoading) return <p className="text-slate-500">{t('common.loading')}</p>;
  if (agencyError || !agency)
    return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{t('common.noAgency')}</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('events.title')}</h1>
        {can.manageEvents && <Button onClick={openCreate}>+ {t('events.new')}</Button>}
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : events.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {t('events.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                    <Link
                      to={`/events/${ev.id}/passengers`}
                      className="mr-1 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-slate-100"
                    >
                      {t('events.viewPassengers')}
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
