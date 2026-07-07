import React, { useState } from 'react';
import { Section, Field, Learn, Callout, Toggle, StatusPill } from '../components/ui.jsx';

const BIND_MODES = [
  {
    id: 'loopback',
    icon: '💻',
    name: 'loopback',
    desc: 'This machine only (127.0.0.1). Safest — nothing else can connect.',
  },
  {
    id: 'lan',
    icon: '📶',
    name: 'lan',
    desc: 'Devices on your local network (phone on same Wi-Fi) can connect.',
  },
  {
    id: 'tailnet',
    icon: '🔗',
    name: 'tailnet',
    desc: 'Your devices anywhere, privately, via your Tailscale network.',
  },
  {
    id: 'auto',
    icon: '✨',
    name: 'auto',
    desc: 'Let OpenClaw pick: tailnet when available, otherwise loopback.',
  },
];

const DM_SCOPES = [
  ['main', 'main — all DMs share one conversation'],
  ['per-peer', 'per-peer — one conversation per person, across channels'],
  ['per-channel-peer', 'per-channel-peer — one per person per channel'],
  ['per-account-channel-peer', 'per-account-channel-peer — also split by your account'],
];

export default function Gateway({ config, mutate, status }) {
  const gw = config.gateway || {};
  const [showToken, setShowToken] = useState(false);

  const setGw = (fn) =>
    mutate((c) => {
      c.gateway = c.gateway || {};
      fn(c.gateway);
    });

  const regenToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    setGw((g) => {
      g.auth = g.auth || {};
      g.auth.token = token;
    });
  };

  const exposed = (gw.bind || 'loopback') !== 'loopback';
  const noAuth = (gw.auth?.mode || 'none') === 'none';

  return (
    <>
      <h1 className="page-title">Gateway & Session</h1>
      <p className="page-desc">
        The Gateway is OpenClaw's always-on core: one WebSocket server that owns your channels,
        agents, and scheduled jobs. Currently{' '}
        <StatusPill ok={!!status?.gateway?.up} textOk="running" textBad="not running" /> on port{' '}
        <code>{gw.port || 18789}</code>.
      </p>

      {!status?.gateway?.up && (
        <Callout kind="warn">
          ⚡ The Gateway isn't running. Start it in a terminal with{' '}
          <code>openclaw gateway run</code> (foreground) or install it as a background service with{' '}
          <code>openclaw gateway install</code> then <code>openclaw gateway start</code>.
        </Callout>
      )}

      <Learn title="What the Gateway actually does">
        <p>
          Think of the Gateway as a switchboard. Chat channels (WhatsApp, Telegram, the CLI…) all
          deliver messages to it over one WebSocket port. For each incoming message it works out
          which <i>session</i> the message belongs to, which <i>agent</i> should handle it, runs
          the agent turn against the model provider, and delivers the reply back to the right
          channel. Because it holds all the state, it must be running for anything to work — and
          it's also why you only configure credentials once, no matter how many channels you add.
        </p>
      </Learn>

      <Section title="Network exposure" subtitle="Who is allowed to reach your Gateway. Pick a card — this is the gateway.bind setting.">
        <div className="bind-cards">
          {BIND_MODES.map((m) => (
            <div
              key={m.id}
              className={`bind-card ${(gw.bind || 'loopback') === m.id ? 'active' : ''}`}
              onClick={() => setGw((g) => (g.bind = m.id))}
            >
              <div className="bc-icon">{m.icon}</div>
              <div className="bc-name">{m.name}</div>
              <div className="bc-desc">{m.desc}</div>
            </div>
          ))}
        </div>
        {exposed && noAuth && (
          <Callout kind="danger">
            ⚠️ Your Gateway is reachable beyond this machine but has <b>no authentication</b>.
            Switch auth mode to <code>token</code> below before saving.
          </Callout>
        )}
        {exposed && !noAuth && (
          <Callout kind="warn">
            Your Gateway is reachable beyond this machine. That's fine for using OpenClaw from
            your phone — just keep the auth token secret.
          </Callout>
        )}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <Field label="Port" hint="The WebSocket port the Gateway listens on (default 18789).">
            <input
              type="number"
              value={gw.port || 18789}
              onChange={(e) => setGw((g) => (g.port = Number(e.target.value)))}
            />
          </Field>
          <Field
            label="Mode"
            hint="local: this machine runs the Gateway. remote: this machine is a client of a Gateway elsewhere."
          >
            <select value={gw.mode || 'local'} onChange={(e) => setGw((g) => (g.mode = e.target.value))}>
              <option value="local">local</option>
              <option value="remote">remote</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Authentication" subtitle="How clients (dashboard, CLI on other devices, your phone) prove who they are.">
        <div className="grid-2">
          <Field
            label="Auth mode"
            hint="token is the recommended default: clients must present this shared secret to connect."
          >
            <select
              value={gw.auth?.mode || 'none'}
              onChange={(e) =>
                setGw((g) => {
                  g.auth = g.auth || {};
                  g.auth.mode = e.target.value;
                })
              }
            >
              <option value="token">token</option>
              <option value="password">password</option>
              <option value="none">none</option>
              <option value="trusted-proxy">trusted-proxy</option>
            </select>
          </Field>
          <Field
            label="Token"
            hint="Keep this secret — anyone with it controls your OpenClaw. Regenerating invalidates connected clients."
          >
            <div className="row">
              <input
                type={showToken ? 'text' : 'password'}
                value={gw.auth?.token || ''}
                onChange={(e) =>
                  setGw((g) => {
                    g.auth = g.auth || {};
                    g.auth.token = e.target.value;
                  })
                }
              />
              <button className="btn sm" onClick={() => setShowToken((s) => !s)}>
                {showToken ? 'Hide' : 'Show'}
              </button>
              <button className="btn sm" onClick={regenToken}>
                ↻ New
              </button>
            </div>
          </Field>
        </div>
      </Section>

      <Section
        title="Sessions"
        subtitle="A session is one ongoing conversation with its own history. dmScope controls how direct messages map to sessions."
      >
        <Field
          label="DM scope (session.dmScope)"
          hint="Example: with per-channel-peer, the same friend messaging you on WhatsApp and Telegram gets two separate conversations; with per-peer they'd share one."
        >
          <select
            value={config.session?.dmScope || 'main'}
            onChange={(e) =>
              mutate((c) => {
                c.session = c.session || {};
                c.session.dmScope = e.target.value;
              })
            }
          >
            {DM_SCOPES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Learn title="Why session scope matters">
          <p>
            Agents remember context <i>per session</i>. A wider scope (like <code>main</code>)
            means more shared memory but conversations blur together; a narrower scope (like{' '}
            <code>per-channel-peer</code>, your current setting) keeps each person and channel
            cleanly separated at the cost of the agent not connecting dots across them.
          </p>
        </Learn>
      </Section>

      <Section
        title="Tools profile"
        subtitle="Which tool set agents get (shell, file edits, browser, messaging…)."
      >
        <Field
          label="tools.profile"
          hint="coding enables developer tools like exec and file editing. messaging is chat-focused. minimal is the most locked down."
        >
          <input
            type="text"
            list="tools-profiles"
            value={config.tools?.profile || ''}
            onChange={(e) =>
              mutate((c) => {
                c.tools = c.tools || {};
                c.tools.profile = e.target.value;
              })
            }
          />
          <datalist id="tools-profiles">
            {['coding', 'messaging', 'full', 'minimal'].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Callout kind="info">
          🔒 Tools are powerful: the <code>coding</code> profile lets agents run commands on this
          machine. OpenClaw gates risky commands behind exec approvals — see{' '}
          <code>openclaw approvals --help</code>.
        </Callout>
      </Section>

      <Section title="Tailscale" subtitle="Optional: reach your Gateway from anywhere through your private tailnet.">
        <div className="grid-2">
          <Field
            label="Tailscale mode"
            hint="off: not used. serve: private to your tailnet. funnel: exposed to the public internet (be careful)."
          >
            <select
              value={gw.tailscale?.mode || 'off'}
              onChange={(e) =>
                setGw((g) => {
                  g.tailscale = g.tailscale || {};
                  g.tailscale.mode = e.target.value;
                })
              }
            >
              <option value="off">off</option>
              <option value="serve">serve</option>
              <option value="funnel">funnel</option>
            </select>
          </Field>
          <Field label="Reset on exit" hint="Undo the Tailscale serve/funnel config when the Gateway stops.">
            <Toggle
              checked={!!gw.tailscale?.resetOnExit}
              onChange={(v) =>
                setGw((g) => {
                  g.tailscale = g.tailscale || {};
                  g.tailscale.resetOnExit = v;
                })
              }
              label={gw.tailscale?.resetOnExit ? 'enabled' : 'disabled'}
            />
          </Field>
        </div>
        {gw.tailscale?.mode === 'funnel' && (
          <Callout kind="danger">
            ⚠️ <b>funnel</b> publishes your Gateway to the open internet. Only use it with strong
            auth, and prefer <b>serve</b> unless you truly need public access.
          </Callout>
        )}
      </Section>
    </>
  );
}
