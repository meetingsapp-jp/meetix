import { useTranslation } from 'react-i18next';

// Shared loading indicator so every page shows the same thing instead of
// plain "Cargando..." text.
export default function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-6 text-slate-500 dark:text-slate-400">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}
