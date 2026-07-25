import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent';
