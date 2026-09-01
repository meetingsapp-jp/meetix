import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import { Field, focusFirstInvalid, inputClass, invalidClass } from '../../components/ui/Field';
import type { AppUser, Client, EventStatus, EventWithMeta } from '../../types';
import { createClient, listClients, listCoordinators, listEventCoordinatorIds, uploadEventSign, type EventInput } from '../../data/events';

const STATUSES: EventStatus[] = ['planificacion', 'confirmado', 'en_curso', 'finalizado', 'cancelado'];

interface Props {
  agencyId: string;
  initial?: EventWithMeta | null;
  onSubmit: (input: EventInput, coordinatorIds: string[]) => Promise<void>;
  onCancel: () => void;
}

export default function EventForm({ agencyId, initial, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState(initial?.name ?? '');
  const [clientId, setClientId] = useState<string>(initial?.client_id ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [destinations, setDestinations] = useState((initial?.destinations ?? []).join(', '));
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? 'planificacion');
  const [coordinators, setCoordinators] = useState<AppUser[]>([]);
  const [coordinatorIds, setCoordinatorIds] = useState<string[]>([]);
  const [signUrl, setSignUrl] = useState(initial?.welcome_sign_url ?? null);
  const [uploadingSign, setUploadingSign] = useState(false);
  const signInputRef = useRef<HTMLInputElement>(null);

  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCountry, setNewClientCountry] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    listClients(agencyId).then(setClients).catch((e) => setError(e.message));
    listCoordinators(agencyId).then(setCoordinators).catch(() => {});
  }, [agencyId]);

  useEffect(() => {
    if (initial) {
      listEventCoordinatorIds(initial.id).then(setCoordinatorIds).catch(() => {});
    }
  }, [initial]);

  function toggleCoordinator(id: string) {
    setCoordinatorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSign(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !initial) return;
    setUploadingSign(true);
    setError(null);
    try {
      const url = await uploadEventSign(agencyId, initial.id, file);
      setSignUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingSign(false);
      if (signInputRef.current) signInputRef.current.value = '';
    }
  }

  async function handleAddClient() {
    if (!newClientName.trim()) return;
    try {
      const created = await createClient(agencyId, newClientName.trim(), newClientCountry.trim() || null);
      setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(created.id);
      setAddingClient(false);
      setNewClientName('');
      setNewClientCountry('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!focusFirstInvalid(formRef.current)) return;
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        {
          name: name.trim(),
          client_id: clientId || null,
          start_date: startDate || null,
          end_date: endDate || null,
          destinations: destinations.split(',').map((d) => d.trim()).filter(Boolean),
          status,
        },
        coordinatorIds,
      );
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Field label={t('events.form.name')}>
        <input
          className={`${inputClass} ${submitAttempted ? invalidClass : ''}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {submitAttempted && !name.trim() && (
          <p className="mt-1 text-xs text-red-600">{t('common.requiredField')}</p>
        )}
      </Field>

      <Field label={t('events.form.client')}>
        {!addingClient ? (
          <div className="flex gap-2">
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">{t('events.form.noClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.country ? ` (${c.country})` : ''}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => setAddingClient(true)}>
              + {t('events.form.newClient')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded border border-slate-200 p-2">
            <input
              className={inputClass}
              placeholder={t('events.form.clientName')}
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder={t('events.form.clientCountry')}
              value={newClientCountry}
              onChange={(e) => setNewClientCountry(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" onClick={handleAddClient}>{t('common.save')}</Button>
              <Button type="button" variant="ghost" onClick={() => setAddingClient(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('events.form.startDate')}>
          <input type="date" className={inputClass} value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('events.form.endDate')}>
          <input type="date" className={inputClass} value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <Field label={t('events.form.destinations')}>
        <input
          className={inputClass}
          value={destinations}
          onChange={(e) => setDestinations(e.target.value)}
          placeholder={t('events.form.destinationsHint')}
        />
      </Field>

      <Field label={t('events.form.status')}>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`events.status.${s}`)}</option>
          ))}
        </select>
      </Field>

      {initial && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('events.form.welcomeSign')}</span>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              {signUrl ? (
                <img src={signUrl} alt={t('events.form.welcomeSign')} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
            <Button type="button" variant="secondary" onClick={() => signInputRef.current?.click()} disabled={uploadingSign}>
              {uploadingSign ? t('settings.uploading') : t('events.form.uploadSign')}
            </Button>
            <input ref={signInputRef} type="file" accept="image/*" className="hidden" onChange={handleSign} />
          </div>
          <p className="mt-1 text-xs text-slate-400">{t('events.form.welcomeSignHint')}</p>
        </div>
      )}

      {coordinators.length > 0 && (
        <Field label={t('events.form.coordinators')}>
          <div className="space-y-1 rounded border border-slate-200 p-2 dark:border-slate-600">
            {coordinators.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={coordinatorIds.includes(c.id)}
                  onChange={() => toggleCoordinator(c.id)}
                />
                {c.full_name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">{t('events.form.coordinatorsHint')}</p>
        </Field>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}
