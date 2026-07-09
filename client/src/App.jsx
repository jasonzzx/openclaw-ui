import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getConfig, getStatus, previewConfig, applyConfig } from './api.js';
import { Modal, DiffView, Toast, StatusPill } from './components/ui.jsx';
import Overview from './pages/Overview.jsx';
import Agents from './pages/Agents.jsx';
import Channels from './pages/Channels.jsx';
import Gateway from './pages/Gateway.jsx';
import Plugins from './pages/Plugins.jsx';
import Chat from './pages/Chat.jsx';
import Backups from './pages/Backups.jsx';

const PAGES = [
  { id: 'overview', label: 'Overview', icon: '🦞' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'channels', label: 'Channels & Routing', icon: '✈️' },
  { id: 'gateway', label: 'Gateway & Session', icon: '🛰️' },
  { id: 'plugins', label: 'Plugins & Auth', icon: '🧩' },
  { id: 'chat', label: 'Chat Console', icon: '💬' },
  { id: 'backups', label: 'Backups', icon: '🗂️' },
];

export default function App() {
  const [page, setPage] = useState('overview');
  const [saved, setSaved] = useState(null); // last config read from disk
  const [mtimeMs, setMtimeMs] = useState(null);
  const [draft, setDraft] = useState(null); // config with unsaved edits
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [review, setReview] = useState(null); // { patch, changed } | 'loading'
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((t) => {
    setToast(t);
    window.clearTimeout(showToast._h);
    showToast._h = window.setTimeout(() => setToast(null), 7000);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const { config, mtimeMs } = await getConfig();
      setSaved(config);
      setDraft(structuredClone(config));
      setMtimeMs(mtimeMs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  const refreshStatus = useCallback(() => {
    getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    loadConfig();
    refreshStatus();
    const t = setInterval(refreshStatus, 10000);
    return () => clearInterval(t);
  }, [loadConfig, refreshStatus]);

  // Pages mutate a clone of the draft; the draft only reaches disk via Review & Apply.
  const mutate = useCallback((fn) => {
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });
  }, []);

  const dirtySections = useMemo(() => {
    if (!saved || !draft) return [];
    const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]);
    return [...keys].filter(
      (k) => JSON.stringify(saved[k]) !== JSON.stringify(draft[k])
    );
  }, [saved, draft]);

  // The file can change under us (CLI, another tool). With no local edits, follow it
  // silently; with edits pending, the mtime check on apply reports the conflict.
  useEffect(() => {
    if (
      status?.mtimeMs &&
      mtimeMs &&
      Math.abs(status.mtimeMs - mtimeMs) > 1 &&
      dirtySections.length === 0
    ) {
      loadConfig();
    }
  }, [status, mtimeMs, dirtySections, loadConfig]);

  const openReview = async () => {
    setReview('loading');
    try {
      setReview(await previewConfig(draft));
    } catch (err) {
      setReview(null);
      showToast({ kind: 'error', title: 'Could not compute diff', detail: err.message });
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const res = await applyConfig(draft, mtimeMs);
      setSaved(res.config);
      setDraft(structuredClone(res.config));
      setMtimeMs(res.mtimeMs);
      setReview(null);
      showToast({ kind: 'ok', title: '✓ Config saved — backup created', detail: res.backup });
      refreshStatus();
    } catch (err) {
      showToast({ kind: 'error', title: 'Save failed', detail: err.message });
    } finally {
      setApplying(false);
    }
  };

  const discard = () => setDraft(structuredClone(saved));

  if (loadError) {
    return (
      <div className="app">
        <div className="main">
          <div className="page">
            <h1 className="page-title">🦞 OpenClaw UI</h1>
            <div className="callout danger">
              Could not read your OpenClaw config: <code>{loadError}</code>
              <br />
              Make sure OpenClaw is installed and <code>~/.openclaw/openclaw.json</code> exists
              (run <code>openclaw configure</code> once), then reload.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  const pageProps = {
    config: draft,
    saved,
    status,
    mutate,
    go: setPage,
    showToast,
    reload: loadConfig,
    refreshStatus,
  };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <span className="logo">🦞</span>
          <span>
            <div className="name">OpenClaw UI</div>
            <div className="sub">agent manager</div>
          </span>
        </div>
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={`nav-item ${page === p.id ? 'active' : ''}`}
            onClick={() => setPage(p.id)}
          >
            <span>{p.icon}</span> {p.label}
            {p.id === 'agents' && draft.agents?.list && (
              <span style={{ marginLeft: 'auto' }} className="badge">
                {draft.agents.list.length}
              </span>
            )}
          </button>
        ))}
        <div className="spacer" />
        <div className="foot">
          {status?.version ? `OpenClaw ${status.version}` : 'OpenClaw'}
          <br />
          <StatusPill ok={!!status?.gateway?.up} textOk="gateway up" textBad="gateway down" />
        </div>
      </nav>

      <main className="main">
        <div className="page">
          {page === 'overview' && <Overview {...pageProps} />}
          {page === 'agents' && <Agents {...pageProps} />}
          {page === 'channels' && <Channels {...pageProps} />}
          {page === 'gateway' && <Gateway {...pageProps} />}
          {page === 'plugins' && <Plugins {...pageProps} />}
          {page === 'chat' && <Chat {...pageProps} />}
          {page === 'backups' && <Backups {...pageProps} />}
        </div>
      </main>

      {dirtySections.length > 0 && (
        <div className="changes-bar">
          <span>
            ✏️ Unsaved changes in{' '}
            <b>{dirtySections.map((s) => s).join(', ')}</b>
          </span>
          <button className="btn ghost sm" onClick={discard}>
            Discard
          </button>
          <button className="btn primary sm" onClick={openReview}>
            Review & Apply
          </button>
        </div>
      )}

      {review && (
        <Modal
          wide
          title="Review changes to openclaw.json"
          onClose={() => setReview(null)}
          footer={
            <>
              <button className="btn" onClick={() => setReview(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={
                  applying ||
                  review === 'loading' ||
                  !review.changed ||
                  review.validation?.ok === false
                }
                onClick={apply}
              >
                {applying ? 'Applying…' : 'Apply (backup created first)'}
              </button>
            </>
          }
        >
          <div className="callout info">
            🛡️ Before writing, the current <code>openclaw.json</code> is copied to{' '}
            <code>~/.openclaw/config-backups/</code>. You can restore any backup from the{' '}
            <b>Backups</b> page. A running Gateway usually picks up config changes on restart —
            restart it with <code>openclaw gateway restart</code> if a change doesn't take effect.
          </div>
          {review === 'loading' ? (
            <p className="muted">Computing diff and validating…</p>
          ) : review.changed ? (
            <>
              {review.validation?.ok && (
                <p className="small" style={{ color: 'var(--ok)' }}>
                  ✓ Proposed config passes <code>openclaw config validate</code>
                </p>
              )}
              {review.validation === null && (
                <p className="small muted">
                  openclaw CLI not found — skipping validation, review the diff carefully.
                </p>
              )}
              {review.validation && review.validation.ok === false && (
                <div className="callout danger">
                  ✗ OpenClaw's validator rejected this config, so applying is disabled:
                  <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>
                    {review.validation.output}
                  </pre>
                </div>
              )}
              <DiffView patch={review.patch} />
            </>
          ) : (
            <p className="muted">No effective changes — the proposed config is identical.</p>
          )}
        </Modal>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
