import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CopyLink from '../../components/ui/CopyLink';
import { Field, inputClass } from '../../components/ui/Field';
import type { AppUser, UserRole } from '../../types';

const INVITE_ROLES: UserRole[] = ['director_general', 'director_eventos', 'planificador', 'guia_coordinador'];
const ALL_ROLES: UserRole[] = ['director_general', 'director_eventos', 'planificador', 'guia_coordinador'];

type ModalType = 'role' | 'edit' | 'password' | 'invite' | null;

export default function TeamPage() {
  const { t } = useTranslation();
  const { can, appUser } = useAuth();
  const [members, setMembers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>('planificador');
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !appUser) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('agency_id', appUser.agency_id)
      .order('full_name');
    if (error) setError(error.message);
    else setMembers((data as AppUser[]) ?? []);
    setLoading(false);
  }, [appUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpdateRole = async (memberId: string, newRole: UserRole) => {
    if (!supabase) return;
    const { error } = await supabase.from('app_users').update({ role: newRole }).eq('id', memberId);
    if (error) {
      setError(error.message);
    } else {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
      setModal(null);
      setSelectedId(null);
    }
  };

  const handleUpdateProfile = async (memberId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('app_users').update({ full_name: editingName, email: editingEmail }).eq('id', memberId);
    if (error) {
      setError(error.message);
    } else {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, full_name: editingName, email: editingEmail } : m)));
      setModal(null);
      setSelectedId(null);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!supabase || !confirm('¿Eliminar este usuario permanentemente?')) return;
    const { error } = await supabase.from('app_users').delete().eq('id', memberId);
    if (error) {
      setError(error.message);
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setModal(null);
      setSelectedId(null);
    }
  };

  const member = members.find((m) => m.id === selectedId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('team.title')}</h1>
        {can.manageTeam && <Button onClick={() => { setModal('invite'); setSelectedId(null); }}>+ {t('team.invite')}</Button>}
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
                {can.manageTeam && <th className="px-3 py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {m.full_name}
                    {m.id === appUser?.id && <span className="ml-2 text-xs text-slate-400">({t('team.you')})</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{m.email ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{t(`roles.${m.role}`)}</td>
                  {can.manageTeam && (
                    <td className="px-3 py-2 space-x-1">
                      {m.id !== appUser?.id && (
                        <>
                          <button onClick={() => { setSelectedId(m.id); setEditingRole(m.role); setModal('role'); }} className="text-xs text-blue-600 hover:underline">Rol</button>
                          <button onClick={() => { setSelectedId(m.id); setEditingName(m.full_name); setEditingEmail(m.email ?? ''); setModal('edit'); }} className="text-xs text-blue-600 hover:underline">Editar</button>
                          <button onClick={() => { setSelectedId(m.id); setModal('password'); }} className="text-xs text-blue-600 hover:underline">Reset</button>
                          <button onClick={() => handleDelete(m.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editar Rol Modal */}
      <Modal open={modal === 'role'} title="Editar rol" onClose={() => setModal(null)}>
        {member && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{member.full_name}</p>
            <Field label={t('roles.label')}>
              <select className={inputClass} value={editingRole} onChange={(e) => setEditingRole(e.target.value as UserRole)}>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{t(`roles.${r}`)}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
              <Button onClick={() => handleUpdateRole(member.id, editingRole)}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Editar Perfil Modal */}
      <Modal open={modal === 'edit'} title="Editar perfil" onClose={() => setModal(null)}>
        {member && (
          <div className="space-y-3">
            <Field label={t('team.name')}>
              <input className={inputClass} value={editingName} onChange={(e) => setEditingName(e.target.value)} />
            </Field>
            <Field label={t('team.email')}>
              <input type="email" className={inputClass} value={editingEmail} onChange={(e) => setEditingEmail(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
              <Button onClick={() => handleUpdateProfile(member.id)}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={modal === 'password'} title="Resetear contraseña" onClose={() => setModal(null)}>
        {member && (
          <SendInviteOptions member={member} onDone={() => setModal(null)} />
        )}
      </Modal>

      {/* Invite Modal */}
      <Modal open={modal === 'invite'} title={t('team.invite')} onClose={() => setModal(null)}>
        <InviteForm onDone={() => { setModal(null); refresh(); }} onCancel={() => setModal(null)} />
      </Modal>
    </div>
  );
}

function SendInviteOptions({ member, onDone }: { member: AppUser; onDone: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generateLink = async () => {
    if (!member.email || !supabase) return;
    setBusy(true);
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: member.email,
      options: { redirectTo: `${window.location.origin}/reset` },
    });
    setBusy(false);
    if (error) alert(`Error: ${error.message}`);
    else setLink(data?.properties?.action_link ?? '');
  };

  if (!member.email) {
    return (
      <div className="rounded bg-yellow-50 p-3 text-sm text-yellow-700">
        No hay email registrado para este usuario. Agrega uno primero.
      </div>
    );
  }

  if (link) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">✓ Invitación generada</p>
        <CopyLink link={link} />
        <p className="text-xs text-slate-500">O comparte por:</p>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hola ${member.full_name}, te invito a MEETIX: ${link}`)}`}
            target="_blank"
            rel="noopener"
            className="flex-1 rounded bg-green-100 px-3 py-2 text-center text-sm text-green-700 hover:bg-green-200"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:${member.email}?subject=Invitación a MEETIX&body=Hola ${member.full_name},%0A%0AEsto es tu link para acceder:%0A${link}%0A%0aSaludos`}
            className="flex-1 rounded bg-blue-100 px-3 py-2 text-center text-sm text-blue-700 hover:bg-blue-200"
          >
            Email
          </a>
        </div>
        <div className="flex justify-end">
          <Button onClick={onDone}>Listo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Generar link de invitación para <strong>{member.full_name}</strong></p>
      <Button onClick={generateLink} disabled={busy} className="w-full">
        {busy ? 'Generando...' : 'Generar link'}
      </Button>
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
