import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { inputClass } from '../../components/ui/Field';
import { downloadPassengerTemplate, parsePassengerFile, type ParsedRow } from '../../lib/import/passengers';
import { bulkImportPassengers } from '../../data/passengers';
import { extractItineraryText } from '../../lib/import/ai';

interface Props {
  agencyId: string;
  eventId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ agencyId, eventId, open, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'ai'>('file');
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [aiText, setAiText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validCount = rows?.filter((r) => r.valid).length ?? 0;
  const invalidCount = (rows?.length ?? 0) - validCount;

  function reset() {
    setRows(null);
    setFileName('');
    setAiText('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleAnalyze() {
    if (!aiText.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const parsed = await extractItineraryText(aiText.trim());
      if (!parsed.length) setError(t('import.aiEmpty'));
      setRows(parsed);
    } catch (err) {
      setError((err as Error).message);
      setRows(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      const parsed = await parsePassengerFile(file);
      if (!parsed.length) setError(t('import.empty'));
      setRows(parsed);
    } catch (err) {
      setError((err as Error).message);
      setRows(null);
    }
  }

  async function handleImport() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      const { inserted } = await bulkImportPassengers(agencyId, eventId, rows);
      reset();
      onImported();
      onClose();
      // small confirmation via alert keeps the flow simple
      window.setTimeout(() => window.alert(t('import.done', { count: inserted })), 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t('import.title')} onClose={() => { reset(); onClose(); }}>
      <div className="space-y-4">
        <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-600">
          {(['file', 'ai'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setRows(null); setError(null); }}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                mode === m ? 'bg-brand-accent text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {m === 'file' ? t('import.modeFile') : t('import.modeAi')}
            </button>
          ))}
        </div>

        {mode === 'file' ? (
          <>
            <p className="text-sm text-slate-600">{t('import.intro')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" type="button" onClick={() => downloadPassengerTemplate()}>
                {t('import.downloadTemplate')}
              </Button>
              <Button type="button" onClick={() => inputRef.current?.click()}>
                {t('import.chooseFile')}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
              {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">{t('import.aiIntro')}</p>
            <textarea
              className={inputClass}
              rows={6}
              placeholder={t('import.aiPlaceholder')}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="button" onClick={handleAnalyze} disabled={analyzing || !aiText.trim()}>
                {analyzing ? t('import.aiAnalyzing') : t('import.aiAnalyze')}
              </Button>
            </div>
          </>
        )}

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {rows && rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium text-green-700">{t('import.willImport', { count: validCount })}</span>
              {invalidCount > 0 && (
                <span className="text-amber-700"> · {t('import.skipped', { count: invalidCount })}</span>
              )}
            </p>
            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5">{t('passengers.form.fullName')}</th>
                    <th className="px-2 py-1.5">{t('passengers.form.documentId')}</th>
                    <th className="px-2 py-1.5">VIP</th>
                    <th className="px-2 py-1.5">{t('passengers.form.hotel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${r.valid ? '' : 'bg-amber-50 text-amber-800'}`}>
                      <td className="px-2 py-1.5">{r.full_name || t('import.missingName')}</td>
                      <td className="px-2 py-1.5">{r.document_id ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.is_vip ? 'VIP' : '—'}</td>
                      <td className="px-2 py-1.5">{r.hotel ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && <p className="text-xs text-slate-400">{t('import.more', { count: rows.length - 50 })}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={busy || validCount === 0} onClick={handleImport}>
            {busy ? t('import.importing') : t('import.importAction', { count: validCount })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
