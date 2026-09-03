import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Public, no-login page: a driver with no MEETIX account taps this link
// (shared by the agency, e.g. via WhatsApp) to confirm they're on the way.
// No passenger, event, or agency data is shown or requested here — just a
// single confirmation tap, exactly what the link is for.
export default function EnRoutePage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [providerName, setProviderName] = useState<string | null>(null);

  async function confirm() {
    if (!supabase) return;
    setState('busy');
    const { data, error } = await supabase.functions.invoke('transport-en-route', { body: { token } });
    if (error || !data?.ok) {
      setState('error');
    } else {
      setProviderName(data.providerName ?? null);
      setState('done');
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm">
        {state === 'done' ? (
          <>
            <div className="mb-2 text-3xl">✅</div>
            <h1 className="mb-1 text-lg font-semibold text-slate-800">¡Gracias{providerName ? `, ${providerName}` : ''}!</h1>
            <p className="text-sm text-slate-600">Avisamos al equipo que ya salieron.</p>
          </>
        ) : state === 'error' ? (
          <>
            <div className="mb-2 text-3xl">⚠️</div>
            <h1 className="mb-1 text-lg font-semibold text-slate-800">El link no es válido</h1>
            <p className="text-sm text-slate-600">Pedile a la agencia que te comparta el link de nuevo.</p>
          </>
        ) : (
          <>
            <div className="mb-2 text-3xl">🚐</div>
            <h1 className="mb-2 text-lg font-semibold text-slate-800">Confirmar salida</h1>
            <p className="mb-4 text-sm text-slate-600">Al tocar el botón le avisamos al equipo que ya están en camino. No se pide ningún otro dato.</p>
            <button
              type="button"
              disabled={state === 'busy'}
              onClick={confirm}
              className="w-full rounded-lg bg-brand px-4 py-3 text-base font-medium text-white disabled:opacity-60"
            >
              {state === 'busy' ? 'Enviando…' : 'Ya salimos'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
