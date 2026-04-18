import { ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isPending = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="page-stack compact-gap">
          <div>
            <h3 className="dialog-title">{title}</h3>
            {description ? <p className="muted-text">{description}</p> : null}
            {children}
          </div>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onCancel} disabled={isPending}>
              {cancelLabel}
            </button>
            <button className="primary-button" type="button" onClick={onConfirm} disabled={isPending}>
              {isPending ? 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
