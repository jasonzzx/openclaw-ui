import React, { useEffect, useRef, useState } from 'react';
import { sendChat } from '../api.js';
import { Learn, Callout } from '../components/ui.jsx';

const THINKING = ['default', 'off', 'minimal', 'low', 'medium', 'high'];

export default function Chat({ config, status }) {
  const agents = config.agents?.list || [];
  const defaultAgent = (agents.find((a) => a.default) || agents[0])?.id || '';
  const [agentId, setAgentId] = useState(defaultAgent);
  const [thinking, setThinking] = useState('default');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [log, busy]);

  const send = async () => {
    const message = input.trim();
    if (!message || busy || !agentId) return;
    setInput('');
    setLog((l) => [...l, { role: 'user', text: message, agentId }]);
    setBusy(true);
    const started = Date.now();
    try {
      const res = await sendChat(agentId, message, thinking);
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (res.ok) {
        setLog((l) => [
          ...l,
          { role: 'agent', text: res.text || '(empty reply)', agentId, secs, raw: res.result },
        ]);
      } else {
        setLog((l) => [
          ...l,
          {
            role: 'err',
            text: `${res.error || 'Agent turn failed'}${res.stderr ? `\n${res.stderr}` : ''}`,
            agentId,
            secs,
          },
        ]);
      }
    } catch (err) {
      setLog((l) => [...l, { role: 'err', text: err.message, agentId }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Chat Console</h1>
      <p className="page-desc">
        Send a real turn to one of your agents and inspect exactly what comes back. This is the
        fastest way to verify a new agent or model change actually works.
      </p>

      {!status?.gateway?.up && (
        <Callout kind="warn">
          ⚡ The Gateway looks offline, so turns will fail. Start it with{' '}
          <code>openclaw gateway run</code> (or <code>openclaw gateway start</code> if installed
          as a service), then try again.
        </Callout>
      )}

      <Learn title="What happens when you hit Send">
        <p>
          The UI runs <code>openclaw agent --agent {agentId || '<id>'} --message …</code> under
          the hood — the same path a WhatsApp or Telegram message takes: CLI → Gateway → session
          routing → your agent → its model provider → reply. Each turn calls your model provider,
          so it costs real tokens. The <i>thinking</i> selector asks the model for more or less
          reasoning effort where the model supports it.
        </p>
      </Learn>

      <div className="row" style={{ marginBottom: 12 }}>
        <label className="small muted">Agent</label>
        <select style={{ width: 180 }} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.id}
              {a.default ? ' ★' : ''}
            </option>
          ))}
        </select>
        <label className="small muted">Thinking</label>
        <select style={{ width: 130 }} value={thinking} onChange={(e) => setThinking(e.target.value)}>
          {THINKING.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {log.length > 0 && (
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setLog([])}>
            Clear
          </button>
        )}
      </div>

      <div className="chat-box">
        <div className="chat-log" ref={logRef}>
          {log.length === 0 && !busy && (
            <div className="chat-empty">
              <div className="big">🦞</div>
              Say hello to <b>{agentId || 'your agent'}</b> — try “introduce yourself in one
              sentence”.
            </div>
          )}
          {log.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="m-meta">
                {m.role === 'user' ? `you → ${m.agentId}` : `${m.agentId}${m.secs ? ` · ${m.secs}s` : ''}`}
              </div>
              {m.text}
              {m.raw && (
                <details>
                  <summary className="faint">raw gateway response</summary>
                  <pre>{JSON.stringify(m.raw, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
          {busy && (
            <div className="msg agent">
              <div className="m-meta">{agentId}</div>
              <span className="thinking-dots">running agent turn via gateway</span>
            </div>
          )}
        </div>
        <div className="chat-input">
          <textarea
            placeholder={`Message ${agentId || 'agent'}… (Enter to send, Shift+Enter for newline)`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn primary" disabled={busy || !input.trim()} onClick={send}>
            {busy ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}
