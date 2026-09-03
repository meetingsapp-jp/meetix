import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DispatchLocation, PassengerWithMeta, ReceptionLocation } from '../../types';
import Modal from '../../components/ui/Modal';
import { inputClass } from '../../components/ui/Field';
import { flightStatusUrl, googleMapsUrl } from '../../lib/links';
import { updatePassengerLogistics, type LogisticsPatch } from '../../data/passengers';
import PassengerQrCode from '../../components/PassengerQrCode';
import type { CheckinEvent } from '../../data/coordinator';

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
const waHref = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`;

const isoTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');
const dm = (iso: string | null) => {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export default function PassengerTransportModal({
  open,
  passenger,
  checkinEvents = [],
  onClose,
  onUpdate,
}: {
  open: boolean;
  passenger: PassengerWithMeta | null;
  checkinEvents?: CheckinEvent[];
  onClose: () => void;
  onUpdate?: (id: string, patch: LogisticsPatch) => void;
}) {
  const { t } = useTranslation();

  // Local, editable copy of the reception/dispatch fields so they can be
  // filled in right here, from wherever the passenger is being looked at,
  // instead of only from the full passenger form.
  const [receptionLocation, setReceptionLocation] = useState<ReceptionLocation | ''>('');
  const [receptionBy, setReceptionBy] = useState('');
  const [receptionSignText, setReceptionSignText] = useState('');
  const [dispatchLocation, setDispatchLocation] = useState<DispatchLocation | ''>('');
  const [dispatchBy, setDispatchBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setReceptionLocation(passenger?.reception_location ?? '');
    setReceptionBy(passenger?.reception_by ?? '');
    setReceptionSignText(passenger?.reception_sign_text ?? '');
    setDispatchLocation(passenger?.dispatch_location ?? '');
    setDispatchBy(passenger?.dispatch_by ?? '');
    setSaveError(null);
    setSaved(false);
    setShowQr(false);
  }, [passenger]);

  if (!passenger) return null;

  const dirty =
    receptionLocation !== (passenger.reception_location ?? '') ||
    receptionBy !== (passenger.reception_by ?? '') ||
    receptionSignText !== (passenger.reception_sign_text ?? '') ||
    dispatchLocation !== (passenger.dispatch_location ?? '') ||
    dispatchBy !== (passenger.dispatch_by ?? '');

  async function handleSaveChanges() {
    setSaving(true);
    setSaveError(null);
    const patch: LogisticsPatch = {
      reception_location: receptionLocation || null,
      reception_by: receptionBy.trim() || null,
      reception_sign_text: receptionSignText.trim() || null,
      dispatch_location: dispatchLocation || null,
      dispatch_by: dispatchBy.trim() || null,
    };
    try {
      await updatePassengerLogistics(passenger!.id, patch);
      onUpdate?.(passenger!.id, patch);
      setSaved(true);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const arrFlight = passenger.flights.find((f) => f.direction === 'arrival');
  const depFlight = passenger.flights.find((f) => f.direction === 'departure');

  const flightStatusLink = (flightNumber: string | null) =>
    flightNumber && (
      <a
        href={flightStatusUrl(flightNumber)}
        target="_blank"
        rel="noopener"
        className="inline-block text-xs font-medium text-blue-700 underline"
      >
        ✈️ {t('coordinator.checkFlightStatus')}
      </a>
    );

  const transportTypeLabel = passenger.is_local_transfer
    ? t('coordinator.local')
    : passenger.is_vip
      ? 'VIP'
      : t('coordinator.groupTransport');

  const checklist = passenger.departure_checklist ?? [];

  return (
    <Modal
      open={open}
      title="Detalles de transporte"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            ← {t('common.back')}
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={saving || !dirty}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('common.saving') : saved ? `✓ ${t('common.changesSaved')}` : t('common.saveChanges')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 1. Pasajero */}
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 shadow-sm dark:bg-slate-700/50">
          {passenger.photo_url && (
            <img src={passenger.photo_url} alt={passenger.full_name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
          )}
          <div>
            <div className="font-semibold">{passenger.full_name}</div>
            <div className="text-xs text-slate-500 mt-1 dark:text-slate-300">
              {passenger.phone && <div>📱 {passenger.phone}</div>}
              {passenger.hotel?.name && (
                <div>
                  🏨 {passenger.hotel.name}{passenger.room_number ? ` · Hab. ${passenger.room_number}` : ''}{' '}
                  <a href={googleMapsUrl(passenger.hotel.address || passenger.hotel.name)} target="_blank" rel="noopener" className="text-blue-700 underline">
                    {t('coordinator.viewMap')}
                  </a>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="ml-auto shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            📱 {showQr ? t('coordinator.qr.hide') : t('coordinator.qr.show')}
          </button>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <PassengerQrCode passengerId={passenger.id} />
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">{t('coordinator.qr.showHint')}</p>
          </div>
        )}

        {(() => {
          const latestHotel = checkinEvents.find((c) => c.checkpoint === 'hotel');
          const latestEvento = checkinEvents.find((c) => c.checkpoint === 'evento');
          if (!latestHotel && !latestEvento) return null;
          return (
            <div className="flex flex-wrap gap-2 text-xs">
              {latestHotel && (
                <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  🏨 {t('coordinator.qr.checkpointHotel')} · {new Date(latestHotel.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {latestEvento && (
                <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  🎫 {t('coordinator.qr.checkpointEvent')} · {new Date(latestEvento.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })()}

        {/* 2. Tipo de traslado */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span
            className={
              'rounded-full px-2.5 py-1 text-xs font-semibold ' +
              (passenger.is_local_transfer
                ? 'bg-violet-100 text-violet-800'
                : passenger.is_vip
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700')
            }
          >
            {transportTypeLabel}
          </span>
        </div>

        {saveError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}

        {/* Recepción / despacho — editable directamente acá */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs dark:border-violet-800 dark:bg-violet-950/20">
            <div className="mb-2 font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">{t('passengers.form.receptionSection')}</div>
            {!(receptionLocation || receptionBy || receptionSignText) && (
              <div className="mb-1.5 text-amber-600">⚠️ {t('coordinator.receptionUndefined')}</div>
            )}
            <div className="space-y-1.5">
              <select
                className={`${inputClass} text-xs`}
                value={receptionLocation}
                onChange={(e) => {
                  setReceptionLocation(e.target.value as ReceptionLocation | '');
                  setSaved(false);
                }}
              >
                <option value="">{t('passengers.form.locationUndefined')}</option>
                <option value="aeropuerto">{t('passengers.form.locationAirport')}</option>
                <option value="hotel">{t('passengers.form.locationHotel')}</option>
                <option value="otro">{t('passengers.form.locationOther')}</option>
              </select>
              <input
                className={`${inputClass} text-xs`}
                placeholder={t('passengers.form.receptionByPlaceholder')}
                value={receptionBy}
                onChange={(e) => { setReceptionBy(e.target.value); setSaved(false); }}
              />
              <input
                className={`${inputClass} text-xs`}
                placeholder={t('passengers.form.receptionSignTextPlaceholder')}
                value={receptionSignText}
                onChange={(e) => { setReceptionSignText(e.target.value); setSaved(false); }}
              />
            </div>
            {passenger.reception_notes && <div className="mt-1.5 text-slate-500 dark:text-slate-400">📝 {passenger.reception_notes}</div>}
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-800 dark:bg-blue-950/20">
            <div className="mb-2 font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{t('passengers.form.dispatchSection')}</div>
            {!(dispatchLocation || dispatchBy) && (
              <div className="mb-1.5 text-amber-600">⚠️ {t('coordinator.dispatchUndefined')}</div>
            )}
            <div className="space-y-1.5">
              <select
                className={`${inputClass} text-xs`}
                value={dispatchLocation}
                onChange={(e) => {
                  setDispatchLocation(e.target.value as DispatchLocation | '');
                  setSaved(false);
                }}
              >
                <option value="">{t('passengers.form.locationUndefined')}</option>
                <option value="hotel">{t('passengers.form.locationHotel')}</option>
                <option value="otro">{t('passengers.form.locationOther')}</option>
              </select>
              <input
                className={`${inputClass} text-xs`}
                placeholder={t('passengers.form.dispatchByPlaceholder')}
                value={dispatchBy}
                onChange={(e) => { setDispatchBy(e.target.value); setSaved(false); }}
              />
            </div>
            {passenger.dispatch_notes && <div className="mt-1.5 text-slate-500 dark:text-slate-400">📝 {passenger.dispatch_notes}</div>}
          </div>
        </div>

        {/* 3. Recorrido: origen → destino */}
        {passenger.is_local_transfer ? (
          (passenger.origin_address || passenger.destination_address) && (
            <div className="border-l-4 border-violet-400 bg-violet-50 p-3 dark:bg-violet-900/20">
              <div className="flex items-center justify-between text-xs font-semibold text-violet-700 uppercase dark:text-violet-300">
                <span>{t('coordinator.localTransferLabel')}</span>
                {passenger.local_transfer_time && (
                  <span className="normal-case font-medium">🕐 {dm(passenger.local_transfer_time)} {isoTime(passenger.local_transfer_time)}</span>
                )}
              </div>
              <div className="mt-1 space-y-1.5 text-sm">
                {passenger.origin_address && (
                  <div>
                    📍 {passenger.origin_address}{' '}
                    <a href={googleMapsUrl(passenger.origin_address)} target="_blank" rel="noopener" className="text-xs font-medium text-blue-700 underline">
                      {t('coordinator.viewMap')}
                    </a>
                  </div>
                )}
                {passenger.destination_address && (
                  <div>
                    🏁 {passenger.destination_address}{' '}
                    <a href={googleMapsUrl(passenger.destination_address)} target="_blank" rel="noopener" className="text-xs font-medium text-blue-700 underline">
                      {t('coordinator.viewMap')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          <>
            {arrFlight && (
              <div className="border-l-4 border-green-400 bg-green-50 p-3 dark:bg-green-900/20">
                <div className="text-xs font-semibold text-green-700 uppercase dark:text-green-300">Llegada</div>
                <div className="mt-1 space-y-1 text-sm">
                  <div>✈️ {[arrFlight.airline, arrFlight.flight_number].filter(Boolean).join(' ')}</div>
                  <div>📅 {dm(arrFlight.flight_datetime)} a las {isoTime(arrFlight.flight_datetime)}</div>
                  {arrFlight.terminal && <div>🚪 Terminal {arrFlight.terminal}</div>}
                  {flightStatusLink(arrFlight.flight_number)}
                </div>
              </div>
            )}
            {depFlight && (
              <div className="border-l-4 border-blue-400 bg-blue-50 p-3 dark:bg-blue-900/20">
                <div className="text-xs font-semibold text-blue-700 uppercase dark:text-blue-300">Salida</div>
                <div className="mt-1 space-y-1 text-sm">
                  {depFlight.pickup_time && (
                    <div>🚐 {t('coordinator.hotelPickup')}: {dm(depFlight.pickup_time)} {isoTime(depFlight.pickup_time)}</div>
                  )}
                  <div>✈️ {[depFlight.airline, depFlight.flight_number].filter(Boolean).join(' ')}</div>
                  <div>📅 {dm(depFlight.flight_datetime)} a las {isoTime(depFlight.flight_datetime)}</div>
                  {depFlight.terminal && <div>🚪 Terminal {depFlight.terminal}</div>}
                  {flightStatusLink(depFlight.flight_number)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Proveedor de transporte */}
        {passenger.transport_provider ? (
          <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-3">
            <div className="font-semibold text-purple-900">Proveedor de transporte</div>
            <div className="mt-2 text-sm font-medium">{passenger.transport_provider.name}</div>
            {passenger.transport_provider.contact_phone ? (
              <div className="mt-2 flex gap-2">
                <a href={telHref(passenger.transport_provider.contact_phone)} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100">📞 Llamar</a>
                <a href={waHref(passenger.transport_provider.contact_phone)} target="_blank" rel="noopener" className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">💬 WhatsApp</a>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mt-1">Sin teléfono de contacto cargado</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm text-slate-500">
            Sin proveedor asignado
          </div>
        )}

        {/* Checklist de despacho */}
        {checklist.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-xs font-semibold text-slate-600 uppercase mb-1 dark:text-slate-300">{t('passengers.form.departureChecklist')}</div>
            <ul className="space-y-1 text-sm">
              {checklist.map((item, idx) => (
                <li key={idx} className={'flex items-center gap-2 ' + (item.done ? 'text-slate-400 line-through' : '')}>
                  <span>{item.done ? '✅' : '⬜'}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dieta/Alergias */}
        {(passenger.dietary || passenger.allergies || passenger.special_needs) && (
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs font-semibold text-amber-700 uppercase mb-1">Requerimientos</div>
            <div className="flex flex-wrap gap-1">
              {passenger.dietary && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700">🍽️ {passenger.dietary}</span>}
              {passenger.allergies && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700">⚠️ {passenger.allergies}</span>}
              {passenger.special_needs && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-700">♿ {passenger.special_needs}</span>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
