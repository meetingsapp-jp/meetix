import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import { Field, focusFirstInvalid, inputClass, invalidClass } from '../../components/ui/Field';
import type { ChecklistItem, DispatchLocation, Flight, Hotel, PassengerWithMeta, Person, ReceptionLocation } from '../../types';
import {
  createHotel,
  listHotels,
  listPeople,
  uploadPersonPhoto,
  type FlightInput,
  type FlightsInput,
  type PassengerInput,
} from '../../data/passengers';
import { googleMapsUrl } from '../../lib/links';

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

// A new (not-yet-saved) passenger's in-progress fields, so an accidental
// back-navigation or the mobile browser reloading a backgrounded tab doesn't
// wipe out everything the user just typed. Not used when editing an existing
// passenger — that data already lives on the server.
interface PassengerDraft {
  fullName: string; email: string; phone: string; documentId: string; nationality: string;
  isVip: boolean; hotelId: string; roomNumber: string; costCenter: string; emergency: string;
  dietary: string; allergies: string; specialNeeds: string; notes: string;
  isLocalTransfer: boolean; originAddress: string; destinationAddress: string; localTransferTime: string;
  receptionLocation: ReceptionLocation | ''; receptionBy: string; receptionSignText: string; receptionNotes: string;
  dispatchLocation: DispatchLocation | ''; dispatchBy: string; dispatchNotes: string;
  arrival: FlightInput; departure: FlightInput;
}

const draftKey = (eventId: string) => `meetix.draft.passenger.${eventId}`;

function readDraft(eventId: string): PassengerDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(eventId));
    return raw ? (JSON.parse(raw) as PassengerDraft) : null;
  } catch {
    return null;
  }
}

function clearDraft(eventId: string) {
  try {
    sessionStorage.removeItem(draftKey(eventId));
  } catch {
    /* ignore */
  }
}

export default function PassengerForm({ agencyId, eventId, initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<Hotel[]>([]);

  // Restore an in-progress draft for a brand-new passenger, if one was left
  // behind by an accidental back-navigation or the tab getting reloaded.
  const draft = useMemo(() => (initial ? null : readDraft(eventId)), [initial, eventId]);

  // Directory (reuse a person across events). Only offered when creating.
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<string | null>(initial?.person_id ?? null);
  const [dirSearch, setDirSearch] = useState('');
  const [dirOpen, setDirOpen] = useState(false);

  const [fullName, setFullName] = useState(draft?.fullName ?? initial?.full_name ?? '');
  const [email, setEmail] = useState(draft?.email ?? initial?.email ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? initial?.phone ?? '');
  const [documentId, setDocumentId] = useState(draft?.documentId ?? initial?.document_id ?? '');
  const [nationality, setNationality] = useState(draft?.nationality ?? initial?.nationality ?? '');
  const [isVip, setIsVip] = useState(draft?.isVip ?? initial?.is_vip ?? false);
  const [hotelId, setHotelId] = useState(draft?.hotelId ?? initial?.hotel_id ?? '');
  const [roomNumber, setRoomNumber] = useState(draft?.roomNumber ?? initial?.room_number ?? '');
  const [costCenter, setCostCenter] = useState(draft?.costCenter ?? initial?.cost_center ?? '');
  const [emergency, setEmergency] = useState(draft?.emergency ?? initial?.emergency_contact ?? '');
  const [dietary, setDietary] = useState(draft?.dietary ?? initial?.dietary ?? '');
  const [allergies, setAllergies] = useState(draft?.allergies ?? initial?.allergies ?? '');
  const [specialNeeds, setSpecialNeeds] = useState(draft?.specialNeeds ?? initial?.special_needs ?? '');
  const [notes, setNotes] = useState(draft?.notes ?? initial?.notes ?? '');
  const [isLocalTransfer, setIsLocalTransfer] = useState(draft?.isLocalTransfer ?? initial?.is_local_transfer ?? false);
  const [originAddress, setOriginAddress] = useState(draft?.originAddress ?? initial?.origin_address ?? '');
  const [destinationAddress, setDestinationAddress] = useState(draft?.destinationAddress ?? initial?.destination_address ?? '');
  const [localTransferTime, setLocalTransferTime] = useState(
    draft?.localTransferTime ?? (initial?.local_transfer_time ? initial.local_transfer_time.slice(0, 16) : ''),
  );
  const [receptionLocation, setReceptionLocation] = useState<ReceptionLocation | ''>(draft?.receptionLocation ?? initial?.reception_location ?? '');
  const [receptionBy, setReceptionBy] = useState(draft?.receptionBy ?? initial?.reception_by ?? '');
  const [receptionSignText, setReceptionSignText] = useState(draft?.receptionSignText ?? initial?.reception_sign_text ?? '');
  const [receptionNotes, setReceptionNotes] = useState(draft?.receptionNotes ?? initial?.reception_notes ?? '');
  const [dispatchLocation, setDispatchLocation] = useState<DispatchLocation | ''>(draft?.dispatchLocation ?? initial?.dispatch_location ?? '');
  const [dispatchBy, setDispatchBy] = useState(draft?.dispatchBy ?? initial?.dispatch_by ?? '');
  const [dispatchNotes, setDispatchNotes] = useState(draft?.dispatchNotes ?? initial?.dispatch_notes ?? '');
  const [departureChecklist, setDepartureChecklist] = useState<ChecklistItem[]>(initial?.departure_checklist ?? []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  // The event usually happens at the passenger's hotel, so by default the
  // destination just follows whichever hotel is selected above; "usar otro
  // lugar" opts out for the odd case (a dinner elsewhere, etc.).
  const [useOtherDestination, setUseOtherDestination] = useState(Boolean(initial?.destination_address));
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [arrival, setArrival] = useState<FlightInput>(draft?.arrival ?? flightOf(initial?.flights, 'arrival'));
  const [departure, setDeparture] = useState<FlightInput>(draft?.departure ?? flightOf(initial?.flights, 'departure'));

  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotel, setNewHotel] = useState('');
  const [newHotelAddress, setNewHotelAddress] = useState('');
  const [newHotelAttempted, setNewHotelAttempted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    listHotels(eventId).then(setHotels).catch((e) => setError(e.message));
  }, [eventId]);

  useEffect(() => {
    if (!initial) listPeople(agencyId).then(setPeople).catch(() => {});
  }, [agencyId, initial]);

  // Keep saving a draft of the in-progress new passenger as they type, so an
  // accidental back-navigation or a backgrounded-tab reload doesn't lose it.
  useEffect(() => {
    if (initial) return;
    const d: PassengerDraft = {
      fullName, email, phone, documentId, nationality, isVip, hotelId, roomNumber, costCenter,
      emergency, dietary, allergies, specialNeeds, notes, isLocalTransfer, originAddress, destinationAddress,
      localTransferTime, receptionLocation, receptionBy, receptionSignText, receptionNotes,
      dispatchLocation, dispatchBy, dispatchNotes,
      arrival, departure,
    };
    try {
      if (!fullName.trim()) sessionStorage.removeItem(draftKey(eventId));
      else sessionStorage.setItem(draftKey(eventId), JSON.stringify(d));
    } catch {
      /* storage unavailable — draft is best-effort */
    }
  }, [
    initial, eventId, fullName, email, phone, documentId, nationality, isVip, hotelId, roomNumber,
    costCenter, emergency, dietary, allergies, specialNeeds, notes, isLocalTransfer, originAddress,
    destinationAddress, localTransferTime, receptionLocation, receptionBy, receptionSignText, receptionNotes,
    dispatchLocation, dispatchBy, dispatchNotes, arrival, departure,
  ]);

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
    setNewHotelAttempted(true);
    if (!newHotel.trim()) return;
    try {
      const h = await createHotel(agencyId, eventId, newHotel.trim(), newHotelAddress.trim() || null);
      setHotels((prev) => [...prev, h].sort((a, b) => a.name.localeCompare(b.name)));
      setHotelId(h.id);
      setAddingHotel(false);
      setNewHotel('');
      setNewHotelAddress('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !initial?.person_id) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadPersonPhoto(agencyId, initial.person_id, file);
      setPhotoUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!focusFirstInvalid(formRef.current)) return;
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    const clean = (s: string) => (s.trim() ? s.trim() : null);
    const selectedHotel = hotels.find((h) => h.id === hotelId);
    const finalDestination =
      isLocalTransfer && selectedHotel && !useOtherDestination
        ? selectedHotel.address || selectedHotel.name
        : destinationAddress;
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
          destination_address: clean(finalDestination),
          local_transfer_time: localTransferTime || null,
          reception_location: receptionLocation || null,
          reception_by: clean(receptionBy),
          reception_sign_text: clean(receptionSignText),
          reception_notes: clean(receptionNotes),
          dispatch_location: dispatchLocation || null,
          dispatch_by: clean(dispatchBy),
          dispatch_notes: clean(dispatchNotes),
          departure_checklist: departureChecklist,
          photo_url: photoUrl,
        },
        {
          arrival: { airline: clean(arrival.airline ?? ''), flight_number: clean(arrival.flight_number ?? ''), flight_datetime: arrival.flight_datetime || null, terminal: clean(arrival.terminal ?? ''), pickup_time: arrival.pickup_time || null },
          departure: { airline: clean(departure.airline ?? ''), flight_number: clean(departure.flight_number ?? ''), flight_datetime: departure.flight_datetime || null, terminal: clean(departure.terminal ?? ''), pickup_time: departure.pickup_time || null },
        },
        personId,
      );
      if (!initial) clearDraft(eventId);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!initial) clearDraft(eventId);
    onCancel();
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
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {draft && <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">{t('passengers.form.draftRestored')}</p>}

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
          {dirOpen && dirSearch.trim() && dirResults.length === 0 && (
            <button
              type="button"
              onClick={() => { setFullName(dirSearch.trim()); setDirSearch(''); setDirOpen(false); }}
              className="mt-1 block w-full rounded border border-dashed border-slate-300 bg-white px-3 py-2 text-left text-sm text-brand-accent hover:bg-slate-50"
            >
              {t('passengers.form.useAsNewName', { name: dirSearch.trim() })}
            </button>
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
        <input
          className={`${inputClass} ${submitAttempted ? invalidClass : ''}`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoFocus
        />
        {submitAttempted && !fullName.trim() && (
          <p className="mt-1 text-xs text-red-600">{t('common.requiredField')}</p>
        )}
      </Field>

      {initial?.person_id && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('passengers.form.photo')}</span>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              {photoUrl ? (
                <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
            <Button type="button" variant="secondary" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
              {uploadingPhoto ? t('settings.uploading') : t('passengers.form.uploadPhoto')}
            </Button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('passengers.form.email')}>
          <input
            type="email"
            className={`${inputClass} ${submitAttempted ? invalidClass : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {submitAttempted && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (
            <p className="mt-1 text-xs text-red-600">{t('common.invalidEmail')}</p>
          )}
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
          <div className="space-y-2">
            <input
              className={`${inputClass} ${newHotelAttempted && !newHotel.trim() ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              placeholder={t('passengers.form.hotelName')}
              value={newHotel}
              onChange={(e) => setNewHotel(e.target.value)}
            />
            {newHotelAttempted && !newHotel.trim() && (
              <p className="text-xs text-red-600">{t('common.requiredField')}</p>
            )}
            <input
              className={inputClass}
              placeholder={t('passengers.form.hotelAddress')}
              value={newHotelAddress}
              onChange={(e) => setNewHotelAddress(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" onClick={handleAddHotel}>{t('common.save')}</Button>
              <Button type="button" variant="ghost" onClick={() => setAddingHotel(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
        {!addingHotel && hotelId && (() => {
          const h = hotels.find((x) => x.id === hotelId);
          return h ? (
            <a href={googleMapsUrl(h.address || h.name)} target="_blank" rel="noopener" className="mt-1 inline-block text-xs text-brand-accent underline">
              📍 {t('passengers.viewOnMap')}
            </a>
          ) : null;
        })()}
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
            <input
              className={`${inputClass} ${submitAttempted ? invalidClass : ''}`}
              value={originAddress}
              onChange={(e) => setOriginAddress(e.target.value)}
              placeholder={t('passengers.form.addressPlaceholder')}
              required
            />
            {submitAttempted && !originAddress.trim() && (
              <p className="mt-1 text-xs text-red-600">{t('common.requiredField')}</p>
            )}
          </Field>
          {(() => {
            const selectedHotel = hotels.find((h) => h.id === hotelId);
            if (selectedHotel && !useOtherDestination) {
              return (
                <Field label={t('passengers.form.destinationAddress')}>
                  <div className={`${inputClass} flex items-center justify-between bg-slate-50 dark:bg-slate-700`}>
                    <span className="truncate">🏨 {selectedHotel.name}</span>
                    <a href={googleMapsUrl(selectedHotel.address || selectedHotel.name)} target="_blank" rel="noopener" className="ml-2 shrink-0 text-brand-accent">📍</a>
                  </div>
                  <button type="button" onClick={() => setUseOtherDestination(true)} className="mt-1 text-xs text-slate-500 underline">
                    {t('passengers.form.useOtherDestination')}
                  </button>
                </Field>
              );
            }
            return (
              <Field label={t('passengers.form.destinationAddress')}>
                <input className={inputClass} value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} placeholder={t('passengers.form.addressPlaceholder')} />
                {selectedHotel && (
                  <button type="button" onClick={() => { setUseOtherDestination(false); setDestinationAddress(''); }} className="mt-1 text-xs text-slate-500 underline">
                    {t('passengers.form.useHotelAsDestination')}
                  </button>
                )}
              </Field>
            );
          })()}
          <Field label={t('passengers.form.localTransferTime')}>
            <input
              type="datetime-local"
              className={inputClass}
              value={localTransferTime}
              onChange={(e) => setLocalTransferTime(e.target.value)}
            />
          </Field>
        </div>
      )}

      {flightBlock(t('passengers.form.arrival'), arrival, setArrival)}
      {flightBlock(t('passengers.form.departure'), departure, setDeparture, true)}

      <fieldset className="rounded border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-600">{t('passengers.form.receptionDispatch')}</legend>

        <div className="rounded border border-violet-100 bg-violet-50/50 p-2 dark:border-violet-900 dark:bg-violet-950/20">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            {t('passengers.form.receptionSection')}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.receptionLocation')}</span>
              <select
                className={inputClass}
                value={receptionLocation}
                onChange={(e) => setReceptionLocation(e.target.value as ReceptionLocation | '')}
              >
                <option value="">{t('passengers.form.locationUndefined')}</option>
                <option value="aeropuerto">{t('passengers.form.locationAirport')}</option>
                <option value="hotel">{t('passengers.form.locationHotel')}</option>
                <option value="otro">{t('passengers.form.locationOther')}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.receptionBy')}</span>
              <input
                className={inputClass}
                placeholder={t('passengers.form.receptionByPlaceholder')}
                value={receptionBy}
                onChange={(e) => setReceptionBy(e.target.value)}
              />
            </label>
          </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.receptionSignText')}</span>
            <input
              className={inputClass}
              placeholder={t('passengers.form.receptionSignTextPlaceholder')}
              value={receptionSignText}
              onChange={(e) => setReceptionSignText(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-2 rounded border border-blue-100 bg-blue-50/50 p-2 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {t('passengers.form.dispatchSection')}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.dispatchLocation')}</span>
              <select
                className={inputClass}
                value={dispatchLocation}
                onChange={(e) => setDispatchLocation(e.target.value as DispatchLocation | '')}
              >
                <option value="">{t('passengers.form.locationUndefined')}</option>
                <option value="hotel">{t('passengers.form.locationHotel')}</option>
                <option value="otro">{t('passengers.form.locationOther')}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.dispatchBy')}</span>
              <input
                className={inputClass}
                placeholder={t('passengers.form.dispatchByPlaceholder')}
                value={dispatchBy}
                onChange={(e) => setDispatchBy(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.receptionNotes')}</span>
            <input
              className={inputClass}
              placeholder={t('passengers.form.receptionNotesPlaceholder')}
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.dispatchNotes')}</span>
            <input
              className={inputClass}
              placeholder={t('passengers.form.dispatchNotesPlaceholder')}
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-2">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('passengers.form.departureChecklist')}</span>
          {departureChecklist.length > 0 && (
            <ul className="mb-2 space-y-1">
              {departureChecklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={item.done}
                    onChange={() => setDepartureChecklist((prev) => prev.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)))}
                  />
                  <span className={item.done ? 'flex-1 text-slate-400 line-through' : 'flex-1'}>{item.label}</span>
                  <button
                    type="button"
                    onClick={() => setDepartureChecklist((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder={t('passengers.form.departureChecklistPlaceholder')}
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (!newChecklistItem.trim()) return;
                setDepartureChecklist((prev) => [...prev, { label: newChecklistItem.trim(), done: false }]);
                setNewChecklistItem('');
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!newChecklistItem.trim()) return;
                setDepartureChecklist((prev) => [...prev, { label: newChecklistItem.trim(), done: false }]);
                setNewChecklistItem('');
              }}
            >
              +
            </Button>
          </div>
        </div>
      </fieldset>

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
        <Button type="button" variant="ghost" onClick={handleCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}
