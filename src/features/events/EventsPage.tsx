import { useTranslation } from 'react-i18next';

export default function EventsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">{t('events.title')}</h1>
      <p className="text-slate-600">{t('events.subtitle')}</p>
      <p className="text-slate-400 text-sm mt-1">{t('common.pendingModule')}</p>
    </div>
  );
}
