import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** The only modal: the backdrop blocks clicks to everything behind it. */
export default function Dialog({
  title, message, confirmLabel = '确认', destructive = false,
  confirmDisabled = false, onConfirm, onCancel, children,
}: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="dialog-backdrop">
      <div className="dialog-panel" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-message">{message}</p>
        {children}
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={onCancel}>取消</button>
          <button
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
