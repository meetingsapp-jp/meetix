import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import type { Flight, Hotel, PassengerWithMeta, Person } from '../../types';
import {
  createHotel,
  listHotels,
  listPeople,
  type FlightInput,
  type FlightsInput,
  type PassengerInput,
} from '../../data/passengers';

interface Props {
  agencyId: string;
  eventId: string;
  initial?: PassengerWithMeta | null;
  onSubmit: (input: PassengerInput, flights: FlightsInput, personId: string | null) => Promise<void>;
  onCancel: () => void;
}

function flightOf(flights: Flight[] | undefined, dir: 'arrival' | 'departure'): FlightInput {
  const f = flights?.find((x) => x.direction === dir);
  return {
    airline: f?.airline ?? '',
    flight_number: f?.flight_number ?? '',
    // datetime-local wants "YYYY-MM-DDTHH:mm"
    flight_datetime: f?.flight_datetime ? f.flight_datetime.slice(0, 16) : '',
    terminal: f?.terminal ?? '',
    pickup_time: f?.pickup_time ? f.pickup_time.slice(0, 16) : '',
  };
}

export default function PassengerForm({ agencyId, eventId, initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<Hotel[]>([]);

  // Directory (reuse a person across events). Only offered when creating.
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<string | null>(initial?.person_id ?? null);
  const [dirSearch, setDirSearch] = useState('');
  const [dirOpen, setDirOpen] = useState(false);

  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [documentId, setDocumentId] = useState(initial?.document_id ?? '');
  const [nationality, setNationality] = useState(initial?.nationality ?? '');
  const [isVip, setIsVip] = useState(initial?.is_vip ?? false);
  const [hotelId, setHotelId] = useState(initial?.hotel_id ?? '');
  const [roomNumber, setRoomNumber] = useState(initial?.room_number ?? '');
  const [costCenter, setCostCenter] = useState(initial?.cost_center ?? '');
  const [emergency, setEmergency] = useState(initial?.emergency_contact ?? '');
  const [dietary, setDietary] = useState(initial?.dietary ?? '');
  const [allergies, setAllergies] = useState(initial?.allergies ?? '');
  const [specialNeeds, setSpecialNeeds] = useState(initial?.special_needs ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isLocalTransfer, setIsLocalTransfer] = useState(initial?.is_local_transfer ?? false);
  const [originAddress, setOriginAddress] = useState(initial?.origin_address ?? '');
  const [destinationAddress, setDestinationAddress] = useState(initial?.destination_address ?? '');

  const [arrival, setArrival] = useState<FlightInput>(flightOf(initial?.flights, 'arrival'));
  const [departure, setDeparture] = useState<FlightInput>(flightOf(initial?.flights, 'departure'));

  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotel, setNewHotel] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listHotels(eventId).then(setHotels).catch((e) => setError(e.message));
  }, [eventId]);

  useEffect(() => {
    if (!initial) listPeople(agencyId).then(setPeople).catch(() => {});
  }, [agencyId, initial]);

  const dirResults = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) =>
        [p.full_name, p.document_id, p.email].some((v) => v?.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [people, dirSearch]);

  function pickPerson(p: Person) {
    setPersonId(p.id);
    setFullName(p.full_name);
    setEmail(p.email ?? '');
    setPhone(p.phone ?? '');
    setDocumentId(p.document_id ?? '');
    setNationality(p.nationality ?? '');
    setDietary(p.dietary ?? '');
    setAllergies(p.allergies ?? '');
    setSpecialNeeds(p.special_needs ?? '');
    setEmergency(p.emergency_contact ?? '');
    setDirSearch('');
    setDirOpen(false);
  }

  async function handleAddHotel() {
    if (!newHotel.trim()) return;
    try {
      const h = await createHotel(agencyId, eventId, newHotel.trim());
      setHotels((prev) => [...prev, h].sort((a, b) => a.name.localeCompare(b.name)));
      setHotelId(h.id);
      setAddingHotel(false);
      setNewHotel('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    const clean = (s: string) => (s.trim() ? s.trim() : null);
    try {
      await onSubmit(
        {
          full_name: fullName.trim(),
          email: clean(email),
          phone: clean(phone),
          document_id: clean(documentId),
          nationality: clean(nationality),
          is_vip: isVip,
          hotel_id: hotelId || null,
          room_number: clean(roomNumber),
          cost_center: clean(costCenter),
          emergency_contact: clean(emergency),
          dietary: clean(dietary),
          allergies: clean(allergies),
          special_needs: clean(specialNeeds),
          notes: clean(notes),
          is_local_transfer: isLocalTransfer,
          origin_address: clean(originAddress),
          destination_address: clean(destinationAddress),
        },
        {
          arrival: { airline: clean(arrival.airline ?? ''), flight_number: clean(arrival.flight_number ?? ''), flight_datetime: arrival.flight_datetime || null, terminal: clean(arrival.terminal ?? ''), pickup_time: arrival.pickup_time || null },
          departure: { airline: clean(departure.airline ?? ''), flight_number: clean(departure.flight_number ?? ''), flight_datetime: departure.flight_datetime || null, terminal: clean(departure.terminal ?? ''), pickup_time: departure.pickup_time || null },
        },
        personId,
      );
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const flightBlock = (
    title: string,
    value: FlightInput,
    setValue: (v: FlightInput) => void,
    showPickup = false,
  ) => (
    <fieldset className="rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-600">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputClass}
          placeholder={t('passengers.form.airline')}
          value={value.airline ?? ''}
          onChange={(e) => setValue({ ...value, airline: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t('passengers.form.flightNumber')}
          value={value.flight_number ?? ''}
          onChange={(e) => setValue({ ...value, flight_number: e.target.value })}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          className={inputClass}
          value={value.flight_datetime ?? ''}
          onChange={(e) => setValue({ ...value, flight_datetime: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t('passengers.form.terminal')}
          value={value.terminal ?? ''}
          onChange={(e) => setValue({ ...value, terminal: e.target.value })}
        />
      </div>
      {showPickup && (
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.pickupTime')}</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={value.pickup_time ?? ''}
            onChange={(e) => setValue({ ...value, pickup_time: e.target.value })}
          />
        </label>
      )}
    </fieldset>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!initial && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t('passengers.form.reuseTitle')}</div>
          <input
            className={inputClass}
            placeholder={t('passengers.form.searchDirectory')}
            value={dirSearch}
            onChange={(e) => { setDirSearch(e.target.value); setDirOpen(true); }}
          />
          {dirOpen && dirResults.length > 0 && (
            <ul className="mt-1 divide-y divide-slate-100 rounded border border-slate-200 bg-white">
              {dirResults.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => pickPerson(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span className="font-medium">{p.full_name}</span>
                    {(p.document_id || p.email) && <span className="text-slate-400"> · {p.document_id ?? p.email}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {personId && (
            <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
              ✓ {t('passengers.form.reusing')}
              <button type="button" className="text-slate-400 underline" onClick={() => setPersonId(null)}>
                {t('passengers.form.asNew')}
              </button>
            </div>
          )}
        </div>
      )}

      <Field label={t('passengers.form.fullName')}>
        <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('passengers.form.email')}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('passengers.form.phone')}>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('passengers.form.documentId')}>
          <input className={inputClass} value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
        </Field>
        <Field label={t('passengers.form.nationality')}>
          <input className={inputClass} value={nationality} onChange={(e) => setNationality(e.target.value)} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} className="h-4 w-4" />
        {t('passengers.form.vip')}
      </label>

      <Field label={t('passengers.form.hotel')}>
        {!addingHotel ? (
          <div className="flex gap-2">
            <select className={inputClass} value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
              <option value="">{t('passengers.form.noHotel')}</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => setAddingHotel(true)}>
              + {t('passengers.form.newHotel')}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder={t('passengers.form.hotelName')}
              value={newHotel}
              onChange={(e) => setNewHotel(e.target.value)}
            />
            <Button type="button" onClick={handleAddHotel}>{t('common.save')}</Button>
            <Button type="button" variant="ghost" onClick={() => setAddingHotel(false)}>{t('common.cancel')}</Button>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('passengers.form.roomNumber')}>
          <input className={inputClass} value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
        </Field>
        <Field label={t('passengers.form.costCenter')}>
          <input className={inputClass} value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder={t('passengers.form.costCenterPlaceholder')} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={isLocalTransfer} onChange={(e) => setIsLocalTransfer(e.target.checked)} className="h-4 w-4" />
        {t('passengers.form.localTransfer')}
      </label>

      {isLocalTransfer && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('passengers.form.originAddress')}>
            <input className={inputClass} value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} placeholder={t('passengers.form.addressPlaceholder')} />
          </Field>
          <Field label={t('passengers.form.destinationAddress')}>
            <input className={inputClass} value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} placeholder={t('passengers.form.addressPlaceholder')} />
          </Field>
        </div>
      )}

      {flightBlock(t('passengers.form.arrival'), arrival, setArrival)}
      {flightBlock(t('passengers.form.departure'), departure, setDeparture, true)}

      <Field label={t('passengers.form.emergency')}>
        <input className={inputClass} value={emergency} onChange={(e) => setEmergency(e.target.value)} />
      </Field>

      <fieldset className="rounded border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-600">{t('passengers.form.requirements')}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.dietary')}</span>
            <input
              className={inputClass}
              list="dietary-options"
              placeholder={t('passengers.form.dietaryPlaceholder')}
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
            />
            <datalist id="dietary-options">
              <option value="Vegetariano" />
              <option value="Vegano" />
              <option value="Sin TACC (celíaco)" />
              <option value="Kosher" />
              <option value="Halal" />
              <option value="Sin lactosa" />
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.allergies')}</span>
            <input className={inputClass} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.specialNeeds')}</span>
          <input
            className={inputClass}
            placeholder={t('passengers.form.specialNeedsPlaceholder')}
            value={specialNeeds}
            onChange={(e) => setSpecialNeeds(e.target.value)}
          />
        </label>
      </fieldset>

      <Field label={t('passengers.form.notes')}>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}
