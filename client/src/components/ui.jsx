import React from 'react';

export function Section({ title, subtitle, actions, children }) {
  return (
    <div className="section">
      {(title || actions) && (
        <div className="section-head">
          {title && <h3 className="section-title">{title}</h3>}
          {actions}
        </div>
      )}
      {subtitle && <p className="section-sub">{subtitle}</p>}
      {children}
    </div>
  );
}

export function Field({ label, hint, badge, children }) {
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {badge}
      </div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Badge({ kind = '', children }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function Learn({ title = 'How this works', open = false, children }) {
  return (
    <details className="learn" open={open}>
      <summary>
        <span>📘</span> {title} <span className="chev">▶</span>
      </summary>
      <div className="learn-body">{children}</div>
    </details>
  );
}

export function Callout({ kind = 'info', children }) {
  return <div className={`callout ${kind}`}>{children}</div>;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <span className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="track">
        <span className="thumb" />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}

export function Modal({ title, onClose, footer, wide, children }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="btn ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusPill({ ok, textOk = 'running', textBad = 'offline' }) {
  return (
    <span className={`pill ${ok ? 'ok' : 'bad'}`}>
      <span className={`dot ${ok ? 'pulse' : ''}`} />
      {ok ? textOk : textBad}
    </span>
  );
}

export function DiffView({ patch }) {
  const lines = (patch || '').split('\n');
  return (
    <div className="diff">
      {lines.map((line, i) => {
        let cls = '';
        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('Index')) cls = 'meta';
        else if (line.startsWith('@@')) cls = 'hunk';
        else if (line.startsWith('+')) cls = 'add';
        else if (line.startsWith('-')) cls = 'del';
        return (
          <div key={i} className={`dl ${cls}`}>
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`} onClick={onDismiss}>
      <div className="t-title">{toast.title}</div>
      {toast.detail && <div className="mono">{toast.detail}</div>}
    </div>
  );
}
