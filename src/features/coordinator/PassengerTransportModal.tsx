import { useTranslation } from 'react-i18next';
import type { PassengerWithMeta } from '../../types';
import Modal from '../../components/ui/Modal';
import { flightStatusUrl, googleMapsUrl } from '../../lib/links';

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
  onClose,
}: {
  open: boolean;
  passenger: PassengerWithMeta | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!passenger) return null;

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
    <Modal open={open} title="Detalles de transporte" onClose={onClose}>
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
        </div>

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
          {(passenger.reception_notes || passenger.dispatch_notes) && (
            <div className="min-w-0 flex-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
              {passenger.reception_notes && <div>📥 {passenger.reception_notes}</div>}
              {passenger.dispatch_notes && <div>📤 {passenger.dispatch_notes}</div>}
            </div>
          )}
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
