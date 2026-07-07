import React, { useCallback, useEffect, useState } from 'react';
import { getBackups, restoreBackup } from '../api.js';
import { Section, Learn, Callout } from '../components/ui.jsx';

const fmtSize = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const fmtTime = (ms) => new Date(ms).toLocaleString();

export default function Backups({ showToast, reload }) {
  const [backups, setBackups] = useState(null);

  const refresh = useCallback(() => {
    getBackups()
      .then((r) => setBackups(r.backups))
      .catch((err) => showToast({ kind: 'error', title: 'Could not list backups', detail: err.message }));
  }, [showToast]);

  useEffect(refresh, [refresh]);

  const restore = async (name) => {
    if (
      !window.confirm(
        `Restore ${name}?\n\nYour current openclaw.json will itself be backed up first, then replaced by this snapshot.`
      )
    )
      return;
    try {
      const res = await restoreBackup(name);
      showToast({ kind: 'ok', title: '✓ Backup restored', detail: `Previous config saved as ${res.backup}` });
      await reload();
      refresh();
    } catch (err) {
      showToast({ kind: 'error', title: 'Restore failed', detail: err.message });
    }
  };

  return (
    <>
      <h1 className="page-title">Backups</h1>
      <p className="page-desc">
        Every time this UI writes <code>openclaw.json</code>, it first snapshots the current file
        here. Restoring is symmetric — the restore itself creates a backup too, so you can never
        lose a state.
      </p>

      <Learn title="Why config backups matter">
        <p>
          <code>openclaw.json</code> is the single source of truth for your whole OpenClaw setup —
          a bad edit can take the Gateway down or misroute your messages. Timestamped snapshots
          turn any mistake into a one-click undo. For full-state backups (sessions, workspaces,
          credentials), see <code>openclaw backup --help</code>.
        </p>
      </Learn>

      <Section title={`Snapshots ${backups ? `(${backups.length})` : ''}`}>
        {!backups ? (
          <p className="muted">Loading…</p>
        ) : backups.length === 0 ? (
          <Callout kind="info">
            No backups yet. One will appear automatically the first time you apply a change.
          </Callout>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Created</th>
                <th>Size</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td>
                    <code>{b.name}</code>
                  </td>
                  <td className="muted">{fmtTime(b.mtimeMs)}</td>
                  <td className="muted">{fmtSize(b.size)}</td>
                  <td>
                    <button className="btn sm" onClick={() => restore(b.name)}>
                      ↩ Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
