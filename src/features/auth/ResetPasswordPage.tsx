import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';

// Same reasoning as LoginPage: this pre-auth card is always light, so it uses
// its own light-only field/input instead of the theme-aware shared ones.
const lightInputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent';

function LightField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(Boolean(s)));

    // Our own shareable links carry ?token_hash=...&type=recovery (see
    // TeamPage) instead of Supabase's raw action_link, so verification only
    // happens here — when actual JS runs in a real browser — never from a
    // WhatsApp/Slack/etc. link-preview bot fetching the URL server-side,
    // which would otherwise burn the single-use token before anyone clicks.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const otpType = params.get('type');
    if (tokenHash && (otpType === 'recovery' || otpType === 'invite' || otpType === 'email')) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType as 'recovery' }).then(({ data, error }) => {
        setReady(Boolean(data.session) && !error);
      });
    } else {
      // Fallback: an older-style action_link redirect puts the session in
      // the URL hash, which the client parses automatically on load.
      supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    }

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
            <LightField label={t('auth.newPassword')}>
              <input type="password" className={lightInputClass} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus minLength={6} />
            </LightField>
            <LightField label={t('auth.confirmPassword')}>
              <input type="password" className={lightInputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </LightField>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t('common.saving') : t('auth.savePassword')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
