import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

// Appended to inputClass on a field once the form failed to validate, so it
// only turns red after the user actually tried to submit (not on first
// render of an empty required field).
export const invalidClass = 'invalid:border-red-500 invalid:ring-1 invalid:ring-red-500';

// Scrolls to and focuses the first invalid control in a form, and returns
// whether the form was valid — so a submit handler can bail out early
// instead of silently doing nothing when a required field is missing.
export function focusFirstInvalid(form: HTMLFormElement | null): boolean {
  if (!form) return true;
  if (form.checkValidity()) return true;
  const firstInvalid = form.querySelector<HTMLElement>(':invalid');
  firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  firstInvalid?.focus();
  return false;
}
