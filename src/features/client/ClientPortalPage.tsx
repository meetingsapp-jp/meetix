import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  createPortalSession,
  deletePortalSession,
  getPortalEvent,
  listPortalSessions,
  updatePortalSession,
  type ClientPortalEvent,
  type ClientPortalSession,
  type ClientSessionInput,
} from '../../data/clientPortal';

type SessionType = 'charla' | 'comida' | 'traslado' | 'actividad' | 'libre';
const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'charla', label: 'Charla' },
  { value: 'comida', label: 'Comida' },
  { value: 'traslado', label: 'Traslado' },
  { value: 'actividad', label: 'Actividad' },
  { value: 'libre', label: 'Tiempo libre' },
];
const typeChip: Record<SessionType, string> = {
  charla: 'bg-blue-100 text-blue-700',
  comida: 'bg-amber-100 text-amber-800',
  traslado: 'bg-violet-100 text-violet-700',
  actividad: 'bg-green-100 text-green-700',
  libre: 'bg-slate-100 text-slate-600',
};

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

const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const isoTime = (iso: string | null) => (iso ? iso.slice(11, 16) : '');
const combine = (date: string, time: string): string | null =>
  date && time ? `${date}T${time}:00` : date ? `${date}T00:00:00` : null;

export default function ClientPortalPage() {
  const { token = '' } = useParams();
  const [event, setEvent] = useState<ClientPortalEvent | null>(null);
  const [sessions, setSessions] = useState<ClientPortalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientPortalSession | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ev, ss] = await Promise.all([getPortalEvent(token), listPortalSessions(token)]);
      setEvent(ev);
      setSessions(ss);
    } catch (e) {
      setError((e as Error).message === 'not_found' ? 'Este link no es válido.' : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  async function handleDelete(s: ClientPortalSession) {
    if (!window.confirm(`¿Eliminar "${s.name}"?`)) return;
    try {
      await deletePortalSession(token, s.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) {
    return <div className="flex min-h-full items-center justify-center text-slate-500">Cargando…</div>;
  }
  if (error && !event) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-accent">Planificación del evento</div>
        <h1 className="mb-1 text-2xl font-semibold text-slate-800">{event?.name}</h1>
        <p className="mb-6 text-sm text-slate-500">
          {event?.start_date ?? ''}{event?.end_date ? ` → ${event.end_date}` : ''}
          {event?.destinations.length ? ` · ${event.destinations.join(', ')}` : ''}
        </p>

        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Agenda</h2>
          <button
            type="button"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="rounded-md bg-brand-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Agregar
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            Todavía no hay nada armado. Empezá agregando una actividad.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const style = s.session_type ? typeChip[s.session_type as SessionType] : typeChip.libre;
              return (
                <li key={s.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="w-16 shrink-0 text-sm text-slate-500">
                    {isoTime(s.starts_at) ? (
                      <>
                        <div className="font-medium text-slate-700">{isoTime(s.starts_at)}</div>
                        {isoTime(s.ends_at) && <div className="text-xs">– {isoTime(s.ends_at)}</div>}
                      </>
                    ) : '—'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{s.name}</span>
                      {s.session_type && (
                        <span className={`rounded-full px-2 py-0.5 text-xs ${style}`}>
                          {SESSION_TYPES.find((t) => t.value === s.session_type)?.label}
                        </span>
                      )}
                    </div>
                    {s.location && <div className="text-sm text-slate-500">{s.location}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditing(s); setFormOpen(true); }}
                      className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formOpen && (
        <ClientSessionForm
          defaultDate={event?.start_date ?? ''}
          initial={editing}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (input) => {
            if (editing) await updatePortalSession(token, editing.id, input);
            else await createPortalSession(token, input);
            setFormOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ClientSessionForm({
  defaultDate,
  initial,
  onSubmit,
  onCancel,
}: {
  defaultDate: string;
  initial: ClientPortalSession | null;
  onSubmit: (input: ClientSessionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(isoDate(initial?.starts_at ?? null) || defaultDate);
  const [start, setStart] = useState(isoTime(initial?.starts_at ?? null));
  const [end, setEnd] = useState(isoTime(initial?.ends_at ?? null));
  const [type, setType] = useState<SessionType | ''>((initial?.session_type as SessionType) ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function applyTemplate(tpl: (typeof QUICK_TEMPLATES)[number]) {
    setName(tpl.name);
    setType(tpl.type);
    setStart(tpl.start);
    setEnd(addMinutes(tpl.start, tpl.durationMin));
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <h3 className="text-lg font-semibold text-slate-800">{initial ? 'Editar actividad' : 'Nueva actividad'}</h3>
        {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        {!initial && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Plantillas rápidas</span>
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
          <span className="mb-1 block text-xs font-medium text-slate-600">Nombre</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Fecha</span>
            <input type="date" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Inicio</span>
            <input type="time" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Fin</span>
            <input type="time" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Tipo</span>
            <select className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={type} onChange={(e) => setType(e.target.value as SessionType | '')}>
              <option value="">— Sin tipo —</option>
              {SESSION_TYPES.map((ty) => (
                <option key={ty.value} value={ty.value}>{ty.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Lugar</span>
            <input className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
