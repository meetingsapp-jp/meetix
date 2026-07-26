import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Field, inputClass } from '../../components/ui/Field';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import CopyLink from '../../components/ui/CopyLink';
import type { Agency, Language } from '../../types';

interface AgencyOverview extends Agency {
  users: number;
  owner: string | null;
  ownerEmail: string | null;
}

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const [rows, setRows] = useState<AgencyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: agencies, error: e1 }, { data: users, error: e2 }] = await Promise.all([
        supabase.from('agencies').select('*').order('created_at', { ascending: false }),
        supabase.from('app_users').select('agency_id, full_name, role, email'),
      ]);
      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      const byAgency = new Map<string, any[]>();
      (users ?? []).forEach((u: any) => {
        const list = byAgency.get(u.agency_id) ?? [];
        list.push(u);
        byAgency.set(u.agency_id, list);
      });
      setRows(
        (agencies ?? []).map((a: any) => {
          const list = byAgency.get(a.id) ?? [];
          const owner = list.find((u) => u.role === 'director_general');
          return { ...a, users: list.length, owner: owner?.full_name ?? null, ownerEmail: owner?.email ?? null };
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function getAccessLink(ownerEmail: string | null) {
    if (!supabase || !ownerEmail) return;
    setError(null);
    const { data, error } = await supabase.functions.invoke('admin-create-agency', {
      body: { action: 'access_link', ownerEmail, redirectTo: `${window.location.origin}/reset` },
    });
    if (error || !(data as any)?.actionLink) {
      setError(t('admin.errGeneric'));
      return;
    }
    setLinkModal((data as any).actionLink);
  }

  return (
    <div className="min-h-full bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-bold">EventOps · {t('admin.title')}</span>
          <div className="flex-1" />
          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white"
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <option key={lng} value={lng} className="text-slate-900">{t(`language.${lng}`)}</option>
            ))}
          </select>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={signOut}>
            {t('auth.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('admin.agencies')}</h1>
          <Button onClick={() => setModalOpen(true)}>+ {t('admin.newAgency')}</Button>
        </div>

        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">{t('admin.noAgencies')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">{t('admin.agencyName')}</th>
                  <th className="px-3 py-2">{t('admin.owner')}</th>
                  <th className="px-3 py-2">{t('admin.users')}</th>
                  <th className="px-3 py-2">{t('admin.created')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {a.owner ?? '—'}
                      {a.ownerEmail && <div className="text-xs text-slate-400">{a.ownerEmail}</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{a.users}</td>
                    <td className="px-3 py-2 text-slate-600">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      {a.ownerEmail && (
                        <Button variant="ghost" onClick={() => getAccessLink(a.ownerEmail)}>{t('admin.accessLink')}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Modal open={modalOpen} title={t('admin.newAgency')} onClose={() => setModalOpen(false)}>
        <NewAgencyForm onDone={() => { setModalOpen(false); refresh(); }} onCancel={() => setModalOpen(false)} />
      </Modal>

      <Modal open={Boolean(linkModal)} title={t('admin.linkTitle')} onClose={() => setLinkModal(null)}>
        {linkModal && <CopyLink link={linkModal} />}
      </Modal>
    </div>
  );
}

function NewAgencyForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [agencyName, setAgencyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [language, setLanguage] = useState<Language>('es');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const errorText = useMemo(
    () => (key: string | null) => {
      switch (key) {
        case 'not_platform_admin': return t('admin.errNotAdmin');
        case 'missing_fields': return t('admin.errMissing');
        default: return key ?? t('admin.errGeneric');
      }
    },
    [t],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke('admin-create-agency', {
      body: {
        agencyName: agencyName.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        language,
        redirectTo: `${window.location.origin}/reset`,
      },
    });
    setBusy(false);
    if (error) {
      let key: string | null = error.message;
      try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); key = b.error ?? key; } } catch { /* ignore */ }
      setError(errorText(key));
      return;
    }
    if ((data as any)?.ok) setCreatedLink((data as any).actionLink ?? '');
    else setError(errorText((data as any)?.error ?? null));
  }

  if (createdLink !== null) {
    return (
      <div className="space-y-3">
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{t('admin.createdOk', { email: ownerEmail })}</p>
        {createdLink && <CopyLink link={createdLink} />}
        <div className="flex justify-end">
          <Button onClick={onDone}>{t('common.save')}</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Field label={t('admin.agencyName')}>
        <input className={inputClass} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} required autoFocus />
      </Field>
      <Field label={t('admin.ownerName')}>
        <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
      </Field>
      <Field label={t('admin.ownerEmail')}>
        <input type="email" className={inputClass} value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
      </Field>
      <Field label={t('admin.language')}>
        <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          {SUPPORTED_LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>{t(`language.${lng}`)}</option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-slate-500">{t('admin.inviteNote')}</p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('admin.createAgency')}</Button>
      </div>
    </form>
  );
}
