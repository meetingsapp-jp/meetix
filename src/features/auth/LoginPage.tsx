import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { SUPPORTED_LANGUAGES } from '../../i18n';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(t('auth.invalidCredentials'));
    setBusy(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) setError(error.message);
    else setInfo(t('auth.resetSent'));
    setBusy(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand">MEETIX</h1>
          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>{t(`language.${lng}`)}</option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {info && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{info}</p>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <Field label={t('auth.email')}>
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Field label={t('auth.password')}>
              <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
              className="w-full text-center text-sm text-brand-accent hover:underline"
            >
              {t('auth.forgot')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-3">
            <p className="text-sm text-slate-600">{t('auth.forgotHint')}</p>
            <Field label={t('auth.email')}>
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t('common.saving') : t('auth.sendReset')}
            </Button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className="w-full text-center text-sm text-brand-accent hover:underline"
            >
              {t('auth.backToLogin')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
