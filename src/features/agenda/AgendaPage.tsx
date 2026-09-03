import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { inputClass } from '../../components/ui/Field';
import { getEvent, listPassengers } from '../../data/passengers';
import {
  createSession,
  deleteSession,
  listAttendeeIds,
  listSessions,
  setAttendance,
  updateSession,
  type SessionInput,
} from '../../data/sessions';
import type { EventRow, PassengerWithMeta, SessionType, SessionWithMeta } from '../../types';
import Spinner from '../../components/ui/Spinner';
import { exportAgendaCsv } from '../../lib/export/agenda';

const SESSION_TYPES: SessionType[] = ['charla', 'comida', 'traslado', 'actividad', 'libre'];

// Quick-fill templates so planners can start from a common agenda item
// (lunch, dinner, transfer, talk) instead of typing every field by hand.
// Duration is only a starting point — end time stays editable afterward.
const QUICK_TEMPLATES: { key: string; name: string; type: SessionType; start: string; durationMin: number }[] = [
  { key: 'almuerzo', name: 'Almuerzo', type: 'comida', start: '13:00', durationMin: 60 },
  { key: 'cena', name: 'Cena', type: 'comida', start: '20:30', durationMin: 90 },
  { key: 'traslado', name: 'Traslado', type: 'traslado', start: '09:00', durationMin: 30 },
  { key: 'curso', name: 'Curso / Charla', type: 'charla', start: '10:00', durationMin: 120 },
];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

// Static Tailwind class strings (kept whole so they survive purge).
const typeStyles: Record<SessionType, { chip: string; bar: string }> = {
  charla:    { chip: 'bg-blue-100 text-blue-700',     bar: 'bg-blue-400' },
  comida:    { chip: 'bg-amber-100 text-amber-800',   bar: 'bg-amber-400' },
  traslado:  { chip: 'bg-violet-100 text-violet-700', bar: 'bg-violet-400' },
  actividad: { chip: 'bg-green-100 text-green-700',   bar: 'bg-green-400' },
  libre:     { chip: 'bg-slate-100 text-slate-600',   bar: 'bg-slate-300' },
};

// Read date/time straight from the ISO string (no timezone conversion) so what
// the planner typed is exactly what shows — the demo runs across zones.
const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const isoTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');
const combine = (date: string, time: string): string | null =>
  date && time ? `${date}T${time}:00` : date ? `${date}T00:00:00` : null;

export default function AgendaPage() {
  const { eventId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { agency, can } = useAuth();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [sessions, setSessions] = useState<SessionWithMeta[]>([]);
  const [passengers, setPassengers] = useState<PassengerWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SessionWithMeta | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<SessionWithMeta | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ev, ss, pax] = await Promise.all([
        getEvent(eventId),
        listSessions(eventId),
        listPassengers(eventId),
      ]);
      setEvent(ev);
      setSessions(ss);
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

  // Group sessions by their day (date portion of starts_at); undated go last.
  const days = useMemo(() => {
    const map = new Map<string, SessionWithMeta[]>();
    for (const s of sessions) {
      const key = isoDate(s.starts_at) || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [sessions]);

  function dayLabel(key: string): string {
    if (key === '—') return t('agenda.noDate');
    const d = new Date(`${key}T00:00:00`);
    return d.toLocaleDateString(i18n.resolvedLanguage, {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: SessionWithMeta) {
    setEditing(s);
    setFormOpen(true);
  }

  async function handleDelete(s: SessionWithMeta) {
    if (!window.confirm(t('agenda.confirmDelete', { name: s.name }))) return;
    try {
      await deleteSession(s.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-1 text-sm text-slate-500">
        <Link to="/events" className="hover:underline">{t('nav.events')}</Link>
        <span> / {event?.name ?? '…'}</span>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('agenda.title')}</h1>
        <div className="flex gap-2">
          {event && sessions.length > 0 && (
            <Button
              variant="secondary"
              onClick={() =>
                exportAgendaCsv(event, sessions, {
                  date: t('agenda.form.date'),
                  start: t('agenda.form.start'),
                  end: t('agenda.form.end'),
                  name: t('agenda.form.name'),
                  type: t('agenda.form.type'),
                  location: t('agenda.form.location'),
                  attendees: t('agenda.attendance'),
                  noDate: t('agenda.noDate'),
                  typeLabel: (type) => t(`agenda.types.${type}`),
                })
              }
            >
              {t('events.export')}
            </Button>
          )}
          {can.manageEvents && <Button onClick={openCreate}>+ {t('agenda.new')}</Button>}
        </div>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          {t('agenda.empty')}
        </p>
      ) : (
        <div className="space-y-6">
          {days.map(([key, items]) => (
            <div key={key}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {dayLabel(key)}
              </h2>
              <ul className="space-y-2">
                {items.map((s) => {
                  const style = s.session_type ? typeStyles[s.session_type] : typeStyles.libre;
                  const start = isoTime(s.starts_at);
                  const end = isoTime(s.ends_at);
                  return (
                    <li key={s.id} className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className={`w-1.5 shrink-0 ${style.bar}`} />
                      <div className="flex flex-1 items-start gap-3 p-3">
                        <div className="w-20 shrink-0 text-sm text-slate-500">
                          {start ? (
                            <>
                              <div className="font-medium text-slate-700">{start}</div>
                              {end && <div className="text-xs">– {end}</div>}
                            </>
                          ) : '—'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{s.name}</span>
                            {s.session_type && (
                              <span className={`rounded-full px-2 py-0.5 text-xs ${style.chip}`}>
                                {t(`agenda.types.${s.session_type}`)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-sm text-slate-500">
                            {s.location && <span>{s.location}</span>}
                            {s.location && s.attendee_count > 0 && <span> · </span>}
                            {s.attendee_count > 0 && (
                              <button
                                type="button"
                                className="text-brand-accent hover:underline"
                                onClick={() => setAttendanceFor(s)}
                              >
                                {t('agenda.attendees', { count: s.attendee_count })}
                              </button>
                            )}
                          </div>
                        </div>
                        {can.manageEvents && (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Button variant="ghost" className="px-2 py-1" onClick={() => setAttendanceFor(s)}>
                              {t('agenda.attendance')}
                            </Button>
                            <div>
                              <Button variant="ghost" className="px-2 py-1" onClick={() => openEdit(s)}>
                                {t('common.edit')}
                              </Button>
                              <Button variant="ghost" className="px-2 py-1 text-red-600" onClick={() => handleDelete(s)}>
                                {t('common.delete')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        title={editing ? t('agenda.editTitle') : t('agenda.new')}
        onClose={() => setFormOpen(false)}
      >
        {agency && (
          <SessionForm
            defaultDate={event?.start_date ?? ''}
            initial={editing}
            onCancel={() => setFormOpen(false)}
            onSubmit={async (input) => {
              if (editing) await updateSession(editing.id, input);
              else await createSession(agency.id, eventId, input);
              setFormOpen(false);
              await refresh();
            }}
          />
        )}
      </Modal>

      {agency && attendanceFor && (
        <AttendanceModal
          agencyId={agency.id}
          session={attendanceFor}
          passengers={passengers}
          canEdit={can.manageEvents}
          onClose={() => setAttendanceFor(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function SessionForm({
  defaultDate,
  initial,
  onSubmit,
  onCancel,
}: {
  defaultDate: string;
  initial: SessionWithMeta | null;
  onSubmit: (input: SessionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(isoDate(initial?.starts_at ?? null) || defaultDate);
  const [start, setStart] = useState(isoTime(initial?.starts_at ?? null));
  const [end, setEnd] = useState(isoTime(initial?.ends_at ?? null));
  const [type, setType] = useState<SessionType | ''>(initial?.session_type ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await onSubmit({
        name: name.trim(),
        starts_at: combine(date, start),
        ends_at: date && end ? combine(date, end) : null,
        session_type: type || null,
        location: location.trim() || null,
      });
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  function applyTemplate(tpl: (typeof QUICK_TEMPLATES)[number]) {
    setName(tpl.name);
    setType(tpl.type);
    setStart(tpl.start);
    setEnd(addMinutes(tpl.start, tpl.durationMin));
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {!initial && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('agenda.form.quickTemplates')}</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-brand-accent hover:text-brand-accent"
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t('agenda.form.name')}</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('agenda.form.date')}</span>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('agenda.form.start')}</span>
          <input type="time" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('agenda.form.end')}</span>
          <input type="time" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('agenda.form.type')}</span>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as SessionType | '')}>
            <option value="">{t('agenda.form.noType')}</option>
            {SESSION_TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(`agenda.types.${ty}`)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('agenda.form.location')}</span>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

function AttendanceModal({
  agencyId,
  session,
  passengers,
  canEdit,
  onClose,
  onChanged,
}: {
  agencyId: string;
  session: SessionWithMeta;
  passengers: PassengerWithMeta[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listAttendeeIds(session.id)
      .then((list) => alive && setIds(new Set(list)))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [session.id]);

  async function toggle(passengerId: string) {
    if (!canEdit) return;
    const attending = !ids.has(passengerId);
    // Optimistic update, then persist.
    setIds((prev) => {
      const next = new Set(prev);
      if (attending) next.add(passengerId);
      else next.delete(passengerId);
      return next;
    });
    setDirty(true);
    try {
      await setAttendance(agencyId, session.id, passengerId, attending);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function close() {
    if (dirty) onChanged();
    onClose();
  }

  return (
    <Modal open title={`${t('agenda.attendance')} — ${session.name}`} onClose={close}>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <Spinner />
      ) : passengers.length === 0 ? (
        <p className="text-slate-500">{t('passengers.empty')}</p>
      ) : (
        <>
          <div className="mb-2 text-sm text-slate-500">
            {t('agenda.attendeesSelected', { count: ids.size, total: passengers.length })}
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {passengers.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={ids.has(p.id)}
                    disabled={!canEdit}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="flex-1 text-sm">{p.full_name}</span>
                  {p.is_vip && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">VIP</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={close}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
