import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import { inputClass } from './Field';

// Shows a shareable access link with a copy button (used by admin + team invites).
export default function CopyLink({ link }: { link: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">{t('admin.linkShareNote')}</p>
      <div className="flex gap-2">
        <input readOnly className={`${inputClass} text-xs`} value={link} onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? t('admin.copied') : t('admin.copy')}
        </Button>
      </div>
    </div>
  );
}
