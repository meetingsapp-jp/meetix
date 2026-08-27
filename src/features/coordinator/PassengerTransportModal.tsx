import type { PassengerWithMeta } from '../../types';
import Modal from '../../components/ui/Modal';

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
  if (!passenger) return null;

  const arrFlight = passenger.flights.find((f) => f.direction === 'arrival');
  const depFlight = passenger.flights.find((f) => f.direction === 'departure');

  return (
    <Modal open={open} title="Detalles de transporte" onClose={onClose}>
      <div className="space-y-4">
        {/* Pasajero */}
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="font-semibold">{passenger.full_name}</div>
          {passenger.is_vip && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">VIP</span>}
          <div className="text-xs text-slate-500 mt-1">
            {passenger.phone && <div>📱 {passenger.phone}</div>}
            {passenger.hotel?.name && <div>🏨 {passenger.hotel.name}{passenger.room_number ? ` · Hab. ${passenger.room_number}` : ''}</div>}
          </div>
        </div>

        {/* Llegada */}
        {arrFlight && (
          <div className="border-l-4 border-green-400 bg-green-50 p-3">
            <div className="text-xs font-semibold text-green-700 uppercase">Llegada</div>
            <div className="mt-1 space-y-1 text-sm">
              <div>✈️ {[arrFlight.airline, arrFlight.flight_number].filter(Boolean).join(' ')}</div>
              <div>📅 {dm(arrFlight.flight_datetime)} a las {isoTime(arrFlight.flight_datetime)}</div>
              {arrFlight.terminal && <div>🚪 Terminal {arrFlight.terminal}</div>}
            </div>
          </div>
        )}

        {/* Salida */}
        {depFlight && (
          <div className="border-l-4 border-blue-400 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-700 uppercase">Salida</div>
            <div className="mt-1 space-y-1 text-sm">
              <div>✈️ {[depFlight.airline, depFlight.flight_number].filter(Boolean).join(' ')}</div>
              <div>📅 {dm(depFlight.flight_datetime)} a las {isoTime(depFlight.flight_datetime)}</div>
              {depFlight.terminal && <div>🚪 Terminal {depFlight.terminal}</div>}
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
