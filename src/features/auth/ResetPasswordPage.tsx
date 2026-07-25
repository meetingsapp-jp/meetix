import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

// Handles both password recovery (forgot) and first-time password set (invite):
// Supabase puts a recovery session in the URL and the client picks it up.
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // A valid recovery/invite link yields a session; enable the form when present.
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(Boolean(s)));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else setDone(true);
    setBusy(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-bold text-brand">{t('auth.setPassword')}</h1>
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {done ? (
          <div className="space-y-3">
            <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{t('auth.passwordUpdated')}</p>
            <Button className="w-full" onClick={() => navigate('/')}>{t('auth.goToApp')}</Button>
          </div>
        ) : !ready ? (
          <p className="text-sm text-slate-600">{t('auth.resetLinkInvalid')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label={t('auth.newPassword')}>
              <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus minLength={6} />
            </Field>
            <Field label={t('auth.confirmPassword')}>
              <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t('common.saving') : t('auth.savePassword')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
