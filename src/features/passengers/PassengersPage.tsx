import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgency } from '../../auth/AgencyContext';
import { useRole } from '../../auth/RoleContext';
import { useAuth } from '../../auth/AuthContext';
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
import { logAudit } from '../../data/audit';
import PassengerForm from './PassengerForm';
import ImportModal from './ImportModal';
import { exportPassengersCsv, exportPassengersXlsx, type PassengerExportLabels } from '../../lib/export/passengers';
import { exportPassengerItinerary, type ItineraryLabels } from '../../lib/export/itinerary';
import { exportRoomingPdf, type RoomingLabels } from '../../lib/export/rooming';
import { openWhatsApp, passengerItineraryText, type WhatsAppLabels } from '../../lib/share/whatsapp';
import { googleMapsUrl } from '../../lib/links';
import PassengerTransportModal from '../coordinator/PassengerTransportModal';

export default function PassengersPage() {
  const { eventId = '' } = useParams();
  const { t } = useTranslation();
  const { agency } = useAgency();
  const { can } = useRole();
  const { appUser } = useAuth();

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
    dietary: t('passengers.form.dietary'),
    allergies: t('passengers.form.allergies'),
    specialNeeds: t('passengers.form.specialNeeds'),
    emergency: t('passengers.form.emergency'),
    notes: t('passengers.form.notes'),
  });

  const roomingLabels = (): RoomingLabels => ({
    title: t('rooming.title'),
    event: t('events.title'),
    generated: t('transport.generated'),
    hotel: t('passengers.form.hotel'),
    room: t('passengers.form.roomNumber'),
    guest: t('rooming.guest'),
    vip: 'VIP',
    phone: t('passengers.form.phone'),
    noHotel: t('rooming.noHotel'),
  });

  const waLabels = (): WhatsAppLabels => ({
    greeting: t('passengers.wa.greeting'),
    hotel: t('passengers.form.hotel'),
    room: t('passengers.form.roomNumber'),
    arrival: t('passengers.form.arrival'),
    departure: t('passengers.form.departure'),
    dietary: t('passengers.form.dietary'),
    vip: 'VIP',
    signature: t('passengers.wa.signature'),
  });

  function shareWhatsApp(p: PassengerWithMeta) {
    if (!event || !agency) return;
    openWhatsApp(p.phone, passengerItineraryText(agency.name, event, p, waLabels()));
  }

  const itineraryLabels = (): ItineraryLabels => ({
    itinerary: t('itinerary.title'),
    event: t('events.title'),
    passenger: t('itinerary.passenger'),
    flights: t('passengers.flights'),
    arrival: t('passengers.form.arrival'),
    departure: t('passengers.form.departure'),
    hotel: t('passengers.form.hotel'),
    room: t('passengers.form.roomNumber'),
    requirements: t('passengers.form.requirements'),
    dietary: t('passengers.form.dietary'),
    allergies: t('passengers.form.allergies'),
    specialNeeds: t('passengers.form.specialNeeds'),
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
  const [exportOpen, setExportOpen] = useState(false);
  const [detail, setDetail] = useState<PassengerWithMeta | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [exportOpen]);

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

  async function handleSubmit(input: PassengerInput, flights: FlightsInput, personId: string | null) {
    if (!agency) return;
    if (editing) await updatePassenger(agency.id, editing.id, editing.person_id, input, flights);
    else await createPassenger(agency.id, eventId, input, flights, personId);
    logAudit({
      agencyId: agency.id,
      eventId,
      actorId: appUser?.id ?? null,
      actorName: appUser?.full_name ?? null,
      action: editing ? 'update_passenger' : 'create_passenger',
      entityType: 'passenger',
      entityLabel: input.full_name,
    });
    setModalOpen(false);
    await refresh();
  }

  async function handleDelete(p: PassengerWithMeta) {
    if (!window.confirm(t('passengers.confirmDelete', { name: p.full_name }))) return;
    try {
      await deletePassenger(p.id);
      if (agency) {
        logAudit({
          agencyId: agency.id,
          eventId,
          actorId: appUser?.id ?? null,
          actorName: appUser?.full_name ?? null,
          action: 'delete_passenger',
          entityType: 'passenger',
          entityLabel: p.full_name,
        });
      }
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
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">
          {t('passengers.title')}{' '}
          <span className="text-base font-normal text-slate-500">({passengers.length})</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          {can.exportData && event && passengers.length > 0 && (
            <div className="relative" ref={exportRef}>
              <Button variant="secondary" onClick={() => setExportOpen((o) => !o)}>
                {t('passengers.export.menu')} ▾
              </Button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {[
                    { label: t('passengers.exportExcel'), fn: () => exportPassengersXlsx(event, passengers, exportLabels()) },
                    { label: t('passengers.exportCsv'), fn: () => exportPassengersCsv(event, passengers, exportLabels()) },
                    { label: t('rooming.button'), fn: () => exportRoomingPdf(event, passengers, roomingLabels(), agency?.brand_color) },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { item.fn(); setExportOpen(false); }}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                    <button onClick={() => setDetail(p)} className="text-left text-brand-accent hover:underline">{p.full_name}</button>
                    {p.email && <div className="text-xs text-slate-400">{p.email}</div>}
                    {(p.dietary || p.allergies || p.special_needs) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.dietary && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">🍽️ {p.dietary}</span>
                        )}
                        {p.allergies && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">⚠️ {p.allergies}</span>
                        )}
                        {p.special_needs && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">♿ {p.special_needs}</span>
                        )}
                      </div>
                    )}
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
                    {p.hotel?.name ? (
                      <>
                        {p.hotel.name}{p.room_number ? ` · ${p.room_number}` : ''}{' '}
                        <a href={googleMapsUrl(p.hotel.address || p.hotel.name)} target="_blank" rel="noopener" className="text-brand-accent" title={t('passengers.viewOnMap')}>📍</a>
                      </>
                    ) : '—'}
                    {p.is_local_transfer && (
                      <div className="mt-0.5 text-xs text-violet-700">
                        {t('coordinator.localTransferLabel')}
                        {p.origin_address && (
                          <> · <a href={googleMapsUrl(p.origin_address)} target="_blank" rel="noopener" className="underline">{t('passengers.origin')}</a></>
                        )}
                        {p.destination_address && (
                          <> · <a href={googleMapsUrl(p.destination_address)} target="_blank" rel="noopener" className="underline">{t('passengers.destination')}</a></>
                        )}
                      </div>
                    )}
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
                    {can.exportData && event && agency && (
                      <Button variant="ghost" className="text-green-600" onClick={() => shareWhatsApp(p)}>
                        {t('passengers.wa.button')}
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
                  <button onClick={() => setDetail(p)} className="text-left font-medium text-brand-accent hover:underline">{p.full_name}</button>
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
                {p.hotel?.name && (
                  <div>
                    {p.hotel.name}{p.room_number ? ` · ${p.room_number}` : ''}{' '}
                    <a href={googleMapsUrl(p.hotel.address || p.hotel.name)} target="_blank" rel="noopener" className="text-brand-accent" title={t('passengers.viewOnMap')}>📍</a>
                  </div>
                )}
                {p.is_local_transfer && (
                  <div className="text-violet-700">
                    {t('coordinator.localTransferLabel')}
                    {p.origin_address && (
                      <> · <a href={googleMapsUrl(p.origin_address)} target="_blank" rel="noopener" className="underline">{t('passengers.origin')}</a></>
                    )}
                    {p.destination_address && (
                      <> · <a href={googleMapsUrl(p.destination_address)} target="_blank" rel="noopener" className="underline">{t('passengers.destination')}</a></>
                    )}
                  </div>
                )}
                <div>{flightSummary(p)}</div>
              </div>
              {(p.dietary || p.allergies || p.special_needs) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.dietary && (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">🍽️ {p.dietary}</span>
                  )}
                  {p.allergies && (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">⚠️ {p.allergies}</span>
                  )}
                  {p.special_needs && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">♿ {p.special_needs}</span>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {can.exportData && event && agency && (
                  <Button variant="secondary" onClick={() => exportPassengerItinerary(agency.name, agency.brand_color, event, p, itineraryLabels())}>
                    {t('itinerary.button')}
                  </Button>
                )}
                {can.exportData && event && agency && (
                  <Button variant="secondary" className="text-green-600" onClick={() => shareWhatsApp(p)}>
                    {t('passengers.wa.button')}
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

      <PassengerTransportModal open={!!detail} passenger={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
