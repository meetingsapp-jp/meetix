import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CopyLink from '../../components/ui/CopyLink';
import { Field, inputClass } from '../../components/ui/Field';
import type { AppUser, UserRole } from '../../types';

const INVITE_ROLES: UserRole[] = ['director_eventos', 'planificador', 'guia_coordinador'];

export default function TeamPage() {
  const { t } = useTranslation();
  const { can, appUser } = useAuth();
  const [members, setMembers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('app_users').select('*').order('full_name');
    if (error) setError(error.message);
    else setMembers((data as AppUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('team.title')}</h1>
        {can.manageTeam && <Button onClick={() => setInviteOpen(true)}>+ {t('team.invite')}</Button>}
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">{t('team.name')}</th>
                <th className="px-3 py-2">{t('team.email')}</th>
                <th className="px-3 py-2">{t('roles.label')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {m.full_name}
                    {m.id === appUser?.id && <span className="ml-2 text-xs text-slate-400">({t('team.you')})</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{m.email ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{t(`roles.${m.role}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={inviteOpen} title={t('team.invite')} onClose={() => setInviteOpen(false)}>
        <InviteForm onDone={() => { setInviteOpen(false); refresh(); }} onCancel={() => setInviteOpen(false)} />
      </Modal>
    </div>
  );
}

function InviteForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('planificador');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function errText(key: string | null) {
    switch (key) {
      case 'not_allowed': return t('team.errNotAllowed');
      case 'not_in_agency': return t('team.errNotAllowed');
      case 'missing_fields': return t('admin.errMissing');
      default: return key ?? t('admin.errGeneric');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke('agency-invite-user', {
      body: { fullName: fullName.trim(), email: email.trim(), role, redirectTo: `${window.location.origin}/reset` },
    });
    setBusy(false);
    if (error) {
      let key: string | null = error.message;
      try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); key = b.error ?? key; } } catch { /* ignore */ }
      setError(errText(key));
      return;
    }
    if ((data as any)?.ok) setLink((data as any).actionLink ?? '');
    else setError(errText((data as any)?.error ?? null));
  }

  if (link !== null) {
    return (
      <div className="space-y-3">
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{t('team.invitedOk', { email })}</p>
        {link && <CopyLink link={link} />}
        <div className="flex justify-end"><Button onClick={onDone}>{t('common.save')}</Button></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Field label={t('team.name')}>
        <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
      </Field>
      <Field label={t('team.email')}>
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t('roles.label')}>
        <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {INVITE_ROLES.map((r) => (
            <option key={r} value={r}>{t(`roles.${r}`)}</option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-slate-500">{t('team.inviteNote')}</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('team.sendInvite')}</Button>
      </div>
    </form>
  );
}
