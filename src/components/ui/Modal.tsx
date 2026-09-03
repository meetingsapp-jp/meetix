import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// On mobile, the hardware/gesture "back" action otherwise navigates the whole
// app away (losing whatever was being typed) instead of just closing the
// modal. Pushing a history entry while open means back closes the modal
// first; a real "leave the page" back only happens on a second press.
function useBackButtonCloses(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ meetixModal: true }, '');
    const onPopState = () => onClose();
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // Closed some other way (X button, save, backdrop click) — pop the
      // entry we pushed so it doesn't linger in history.
      if ((window.history.state as { meetixModal?: boolean } | null)?.meetixModal) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

function useEscapeCloses(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
}

export default function Modal({ open, title, onClose, children, footer }: Props) {
  useBackButtonCloses(open, onClose);
  useEscapeCloses(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-max-h mt-10 flex w-full max-w-lg flex-col rounded-lg bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 dark:border-slate-700">
          <h2 id="modal-title" className="font-semibold dark:text-slate-100">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 text-xl leading-none dark:hover:text-slate-200">
            &times;
          </button>
        </div>
        <div className="overflow-y-auto p-4 dark:text-slate-100">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 dark:border-slate-700">{footer}</div>
        )}
      </div>
    </div>
  );
}
