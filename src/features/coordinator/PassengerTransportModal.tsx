import { useTranslation } from 'react-i18next';
import type { PassengerWithMeta } from '../../types';
import Modal from '../../components/ui/Modal';
import { flightStatusUrl, googleMapsUrl } from '../../lib/links';

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

  return (
    <Modal open={open} title="Detalles de transporte" onClose={onClose}>
      <div className="space-y-4">
        {/* Pasajero */}
        <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
          {passenger.photo_url && (
            <img src={passenger.photo_url} alt={passenger.full_name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
          )}
          <div>
            <div className="font-semibold">{passenger.full_name}</div>
            {passenger.is_vip && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
            {passenger.is_local_transfer && (
              <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-800">{t('coordinator.local')}</span>
            )}
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

        {/* Traslado local (sin vuelo) */}
        {passenger.is_local_transfer && (passenger.origin_address || passenger.destination_address) && (
          <div className="border-l-4 border-violet-400 bg-violet-50 p-3 dark:bg-violet-900/20">
            <div className="text-xs font-semibold text-violet-700 uppercase dark:text-violet-300">{t('coordinator.localTransferLabel')}</div>
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
        )}

        {/* Llegada */}
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

        {/* Salida */}
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

        {/* Proveedor de transporte */}
        {passenger.transport_provider ? (
          <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-3">
            <div className="font-semibold text-purple-900">Proveedor de transporte</div>
            <div className="mt-2 text-sm font-medium">{passenger.transport_provider.name}</div>
            <p className="text-xs text-slate-600 mt-1">Contactar al proveedor para detalles de traslado</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm text-slate-500">
            Sin proveedor asignado
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
