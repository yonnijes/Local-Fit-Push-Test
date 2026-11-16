import type { ReactNode } from 'react';

export type NoticeTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

interface NoticeProps {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}

export function Notice({ tone, title, children, onClose }: NoticeProps) {
  const role = tone === 'bad' ? 'alert' : 'status';

  return (
    <div className={`notice notice--${tone}`} role={role}>
      <div className="notice__content">
        {title ? <p className="notice__title">{title}</p> : null}
        <div className="notice__body">{children}</div>
      </div>
      {onClose ? (
        <button type="button" className="notice__close" onClick={onClose} aria-label="Cerrar aviso">
          ×
        </button>
      ) : null}
    </div>
  );
}
