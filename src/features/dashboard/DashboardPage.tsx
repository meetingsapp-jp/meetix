import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">{t('dashboard.title')}</h1>
      <p className="text-slate-600">{t('dashboard.subtitle')}</p>
    </div>
  );
}
