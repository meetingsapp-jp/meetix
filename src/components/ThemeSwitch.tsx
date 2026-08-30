import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';

const OPTIONS: { id: ThemeMode; icon: string }[] = [
  { id: 'light', icon: '☀️' },
  { id: 'dark', icon: '🌙' },
  { id: 'system', icon: '🖥️' },
];

export default function ThemeSwitch() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  return (
    <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-600">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setMode(opt.id)}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            mode === opt.id
              ? 'bg-brand-accent text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <span aria-hidden>{opt.icon}</span>
          {t(`settings.theme${opt.id.charAt(0).toUpperCase()}${opt.id.slice(1)}`)}
        </button>
      ))}
    </div>
  );
}
