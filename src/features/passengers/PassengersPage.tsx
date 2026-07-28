import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import { useRole } from '../../auth/RoleContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import type { EventRow, PassengerWithMeta } from '../../types';
import {
  createPassenger,
  deletePassenger,
  getEvent,
  listPassengers,
  updatePassenger,
  type FlightsInput,
  type PassengerInput,
} from '../../data/passengers';
import PassengerForm from './PassengerForm';
import ImportModal from './ImportModal';
import { exportPassengersCsv, exportPassengersXlsx, type PassengerExportLabels } from '../../lib/export/passengers';
import { exportPassengerItinerary, type ItineraryLabels } from '../../lib/export/itinerary';

export default function PassengersPage() {
  const { eventId = '' } = useParams();
  const { t } = useTranslation();
  const { agency } = useAgency();
  const { can } = useRole();

  const exportLabels = (): PassengerExportLabels => ({
    sheet: t('passengers.title'),
    name: t('passengers.form.fullName'),
    email: t('passengers.form.email'),
    phone: t('passengers.form.phone'),
    documentId: t('passengers.form.documentId'),
    nationality: t('passengers.form.nationality'),
    vip: 'VIP',
    yes: t('common.yes'),
    no: t('common.no'),
    hotel: t('passengers.form.hotel'),
    room: t('passengers.form.roomNumber'),
    arrivalFlight: t('passengers.form.arrival'),
    arrivalTime: t('passengers.export.arrivalTime'),
    departureFlight: t('passengers.form.departure'),
    departureTime: t('passengers.export.departureTime'),
    emergency: t('passengers.form.emergency'),
    notes: t('passengers.form.notes'),
  });

  const itineraryLabels = (): ItineraryLabels => ({
    itinerary: t('itinerary.title'),
    event: t('events.title'),
    passenger: t('itinerary.passenger'),
    flights: t('passengers.flights'),
    arrival: t('passengers.form.arrival'),
    departure: t('passengers.form.departure'),
    hotel: t('passengers.form.hotel'),
    room: t('passengers.form.roomNumber'),
    contact: t('itinerary.contact'),
    email: t('passengers.form.email'),
    phone: t('passengers.form.phone'),
    emergency: t('passengers.form.emergency'),
    notes: t('passengers.form.notes'),
    vip: 'VIP',
    generated: t('transport.generated'),
    none: '—',
  });

  const [event, setEvent] = useState<EventRow | null>(null);
  const [passengers, setPassengers] = useState<PassengerWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<PassengerWithMeta | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ev, pax] = await Promise.all([getEvent(eventId), listPassengers(eventId)]);
      setEvent(ev);
      setPassengers(pax);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) refresh();
  }, [eventId, refresh]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: PassengerWithMeta) {
    setEditing(p);
    setModalOpen(true);
  }

  async function handleSubmit(input: PassengerInput, flights: FlightsInput) {
    if (!agency) return;
    if (editing) await updatePassenger(agency.id, editing.id, input, flights);
    else await createPassenger(agency.id, eventId, input, flights);
    setModalOpen(false);
    await refresh();
  }

  async function handleDelete(p: PassengerWithMeta) {
    if (!window.confirm(t('passengers.confirmDelete', { name: p.full_name }))) return;
    try {
      await deletePassenger(p.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const flightSummary = (p: PassengerWithMeta) => {
    const parts = p.flights
      .slice()
      .sort((a, b) => a.direction.localeCompare(b.direction))
      .map((f) => {
        const tag = f.direction === 'arrival' ? '↓' : '↑';
        return `${tag} ${[f.airline, f.flight_number].filter(Boolean).join(' ')}`.trim();
      });
    return parts.length ? parts.join('  ') : '—';
  };

  return (
    <div>
      <div className="mb-1 text-sm text-slate-500">
        <Link to="/events" className="hover:underline">{t('nav.events')}</Link>
        <span> / {event?.name ?? '…'}</span>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t('passengers.title')}{' '}
          <span className="text-base font-normal text-slate-500">({passengers.length})</span>
        </h1>
        <div className="flex gap-2">
          {can.exportData && event && passengers.length > 0 && (
            <>
              <Button variant="secondary" onClick={() => exportPassengersXlsx(event, passengers, exportLabels())}>
                {t('passengers.exportExcel')}
              </Button>
              <Button variant="secondary" onClick={() => exportPassengersCsv(event, passengers, exportLabels())}>
                {t('passengers.exportCsv')}
              </Button>
            </>
          )}
          {can.managePassengers && (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>{t('import.button')}</Button>
          )}
          {can.managePassengers && <Button onClick={openCreate}>+ {t('passengers.new')}</Button>}
        </div>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : passengers.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {t('passengers.empty')}
        </p>
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">{t('passengers.form.fullName')}</th>
                <th className="px-3 py-2">{t('passengers.form.documentId')}</th>
                <th className="px-3 py-2">{t('passengers.transport')}</th>
                <th className="px-3 py-2">{t('passengers.form.hotel')}</th>
                <th className="px-3 py-2">{t('passengers.flights')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {p.full_name}
                    {p.email && <div className="text-xs text-slate-400">{p.email}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{p.document_id ?? '—'}</td>
                  <td className="px-3 py-2">
                    {p.is_vip ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">VIP</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t('passengers.group')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.hotel?.name ?? '—'}{p.room_number ? ` · ${p.room_number}` : ''}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{flightSummary(p)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {can.exportData && event && agency && (
                      <Button
                        variant="ghost"
                        className="text-brand-accent"
                        onClick={() => exportPassengerItinerary(agency.name, agency.brand_color, event, p, itineraryLabels())}
                      >
                        {t('itinerary.button')}
                      </Button>
                    )}
                    {can.managePassengers && (
                      <>
                        <Button variant="ghost" onClick={() => openEdit(p)}>{t('common.edit')}</Button>
                        <Button variant="ghost" className="text-red-600" onClick={() => handleDelete(p)}>
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
          {passengers.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{p.full_name}</div>
                  {p.email && <div className="text-xs text-slate-400">{p.email}</div>}
                </div>
                {p.is_vip ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">VIP</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t('passengers.group')}</span>
                )}
              </div>
              <div className="mt-1 space-y-0.5 text-sm text-slate-500">
                {p.document_id && <div>{t('passengers.form.documentId')}: {p.document_id}</div>}
                {p.hotel?.name && <div>{p.hotel.name}{p.room_number ? ` · ${p.room_number}` : ''}</div>}
                <div>{flightSummary(p)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {can.exportData && event && agency && (
                  <Button variant="secondary" onClick={() => exportPassengerItinerary(agency.name, agency.brand_color, event, p, itineraryLabels())}>
                    {t('itinerary.button')}
                  </Button>
                )}
                {can.managePassengers && (
                  <>
                    <Button variant="ghost" onClick={() => openEdit(p)}>{t('common.edit')}</Button>
                    <Button variant="ghost" className="text-red-600" onClick={() => handleDelete(p)}>{t('common.delete')}</Button>
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
        title={editing ? t('passengers.editTitle') : t('passengers.new')}
        onClose={() => setModalOpen(false)}
      >
        {agency && (
          <PassengerForm
            agencyId={agency.id}
            eventId={eventId}
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={() => setModalOpen(false)}
          />
        )}
      </Modal>

      {agency && (
        <ImportModal
          agencyId={agency.id}
          eventId={eventId}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={refresh}
        />
      )}
    </div>
  );
}
