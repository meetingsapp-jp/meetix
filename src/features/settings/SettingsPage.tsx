import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { updateBranding, uploadLogo } from '../../data/agencySettings';

const DEFAULT_COLOR = '#0f172a';
const PRESETS = ['#0f172a', '#2563eb', '#0284c7', '#059669', '#7c3aed', '#db2777', '#ea580c', '#b91c1c'];

export default function SettingsPage() {
  const { t } = useTranslation();
  const { agency, can, refreshAgency } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [color, setColor] = useState(agency?.brand_color ?? DEFAULT_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(agency?.logo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!agency) return <p className="text-slate-500">{t('common.loading')}</p>;
  if (!can.manageTeam) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{t('settings.onlyDirectors')}</p>;

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !agency) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadLogo(agency.id, file);
      setLogoUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    if (!agency) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateBranding(agency.id, { brand_color: color, logo_url: logoUrl });
      await refreshAgency();
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{t('settings.title')}</h1>
      <p className="mb-6 text-slate-600">{t('settings.subtitle')}</p>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{t('settings.saved')}</p>}

      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-5">
        {/* Logo */}
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">{t('settings.logo')}</div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">{t('settings.noLogo')}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? t('settings.uploading') : t('settings.uploadLogo')}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" className="text-red-600" onClick={() => setLogoUrl(null)}>
                  {t('common.delete')}
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </div>
          <p className="mt-1 text-xs text-slate-400">{t('settings.logoHint')}</p>
        </div>

        {/* Color */}
        <div>
          <Field label={t('settings.color')}>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
              <input className={`${inputClass} max-w-[140px]`} value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color.toLowerCase() === c ? 'border-slate-900' : 'border-white shadow'}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">{t('settings.preview')}</div>
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-white" style={{ backgroundColor: color }}>
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="h-7 w-7 rounded object-contain bg-white/10" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded bg-white/20 text-sm font-bold">E</span>
            )}
            <span className="font-semibold">{agency.name}</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>{busy ? t('common.saving') : t('settings.save')}</Button>
        </div>
      </div>
    </div>
  );
}
