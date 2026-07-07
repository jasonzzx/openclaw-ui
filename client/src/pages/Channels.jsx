import React, { useState } from 'react';
import { Section, Field, Badge, Learn, Callout, Toggle, Modal } from '../components/ui.jsx';

const CHANNEL_TYPES = [
  'telegram',
  'whatsapp',
  'discord',
  'slack',
  'signal',
  'imessage',
  'matrix',
  'irc',
  'googlechat',
  'msteams',
  'mattermost',
  'feishu',
  'line',
  'nostr',
  'nextcloud-talk',
  'zalo',
  'synology-chat',
  'twitch',
  'qqbot',
];

const CHANNEL_ICONS = {
  telegram: '✈️',
  whatsapp: '🟢',
  discord: '🎮',
  slack: '💼',
  signal: '🔵',
  imessage: '💬',
  matrix: '🧱',
  irc: '📟',
};

const DM_POLICIES = [
  ['pairing', 'pairing — unknown senders get a pairing code you must approve (recommended)'],
  ['allowlist', 'allowlist — only senders in the allow list below get through'],
  ['open', 'open — anyone who finds the bot can talk to it (careful!)'],
];

const isSecretKey = (k) => /token|secret|password|key/i.test(k);

export default function Channels({ config, mutate, go }) {
  const channels = config.channels || {};
  const agents = config.agents?.list || [];
  const bindings = config.bindings || [];
  const defaultAgent = (agents.find((a) => a.default) || agents[0])?.id;
  const [adding, setAdding] = useState(null); // { type, botToken, name }
  const [shownSecrets, setShownSecrets] = useState({});

  const setChannel = (name, fn) =>
    mutate((c) => {
      c.channels = c.channels || {};
      c.channels[name] = c.channels[name] || {};
      fn(c.channels[name]);
    });

  const removeChannel = (name) => {
    if (
      !window.confirm(
        `Remove the "${name}" channel from the config?\n\nCredentials stored outside openclaw.json (e.g. WhatsApp login sessions) are not deleted.`
      )
    )
      return;
    mutate((c) => {
      delete c.channels[name];
      if (c.plugins?.entries?.[name]) delete c.plugins.entries[name];
      if (c.bindings) {
        c.bindings = c.bindings.filter((b) => b.match?.channel !== name);
        if (!c.bindings.length) delete c.bindings;
      }
    });
  };

  const addChannel = () => {
    const { type, botToken, name } = adding;
    mutate((c) => {
      c.channels = c.channels || {};
      c.channels[type] = c.channels[type] || {};
      const ch = c.channels[type];
      ch.enabled = true;
      if (name?.trim()) ch.name = name.trim();
      if (type === 'telegram') {
        ch.botToken = botToken?.trim() || '';
        ch.dmPolicy = 'pairing';
      }
      // the Gateway only loads a channel whose plugin entry is enabled,
      // so mirror what `openclaw channels add` does
      c.plugins = c.plugins || {};
      c.plugins.entries = c.plugins.entries || {};
      c.plugins.entries[type] = { ...c.plugins.entries[type], enabled: true };
    });
    setAdding(null);
  };

  const setBinding = (i, fn) =>
    mutate((c) => {
      fn(c.bindings[i]);
    });

  const routeBindings = bindings
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.type === 'route');

  return (
    <>
      <h1 className="page-title">Channels & Routing</h1>
      <p className="page-desc">
        Channels are how the outside world reaches your agents — Telegram, WhatsApp, Discord and
        friends all deliver messages to the Gateway, which then <b>routes</b> each conversation to
        an agent. Configure the channel connection here, then decide which agent answers it.
      </p>

      <Learn title="Connect Telegram in 4 steps" open={!channels.telegram}>
        <ul>
          <li>
            <b>1. Create a bot.</b> In Telegram, message <code>@BotFather</code>, send{' '}
            <code>/newbot</code>, pick a name — BotFather replies with a <b>bot token</b> like{' '}
            <code>123456:ABC-DEF…</code>.
          </li>
          <li>
            <b>2. Paste the token here.</b> Click <i>Add channel → telegram</i> below, paste the
            token, then <i>Review & Apply</i>. The token is stored in your local{' '}
            <code>openclaw.json</code> — treat that file like a password.
          </li>
          <li>
            <b>3. Restart the Gateway</b> (<code>openclaw gateway restart</code>, or start it with{' '}
            <code>openclaw gateway run</code>) so it picks up the new channel and starts polling
            Telegram.
          </li>
          <li>
            <b>4. Say hi & pair.</b> DM your bot. With the default <code>pairing</code> policy,
            unknown senders get a short code — approve yours with{' '}
            <code>openclaw pairing approve telegram &lt;code&gt;</code>. After that, your messages
            flow straight to the routed agent.
          </li>
        </ul>
      </Learn>

      <Section
        title={`Configured channels (${Object.keys(channels).length})`}
        subtitle="Everything here lives under the channels key of openclaw.json. Disabled channels stay configured but the Gateway won't connect them."
        actions={
          <button className="btn primary sm" onClick={() => setAdding({ type: 'telegram' })}>
            ＋ Add channel
          </button>
        }
      >
        {Object.keys(channels).length === 0 && (
          <Callout kind="info">
            No channels yet — your agents are only reachable from this machine (CLI, this UI).
            Add Telegram above to talk to them from your phone.
          </Callout>
        )}
        {Object.entries(channels).map(([name, ch]) => (
          <div key={name} className="section" style={{ marginBottom: 12 }}>
            <div className="section-head">
              <h3 className="section-title">
                {CHANNEL_ICONS[name] || '🔌'} {name}{' '}
                {ch.enabled !== false ? <Badge kind="ok">enabled</Badge> : <Badge>disabled</Badge>}
              </h3>
              <div className="row">
                <Toggle
                  checked={ch.enabled !== false}
                  onChange={(v) => setChannel(name, (c) => (c.enabled = v))}
                />
                <button className="btn sm danger" onClick={() => removeChannel(name)}>
                  Remove
                </button>
              </div>
            </div>

            {name === 'telegram' ? (
              <TelegramForm
                ch={ch}
                shown={!!shownSecrets[name]}
                toggleShown={() => setShownSecrets((s) => ({ ...s, [name]: !s[name] }))}
                set={(fn) => setChannel(name, fn)}
              />
            ) : (
              <GenericChannelForm
                name={name}
                ch={ch}
                shownSecrets={shownSecrets}
                setShownSecrets={setShownSecrets}
                set={(fn) => setChannel(name, fn)}
              />
            )}
          </div>
        ))}
      </Section>

      <Section
        title={`Routing — which agent answers which channel (${routeBindings.length})`}
        subtitle="Bindings map incoming traffic to an agent. Anything that matches no binding goes to the default agent."
        actions={
          <button
            className="btn sm"
            disabled={!agents.length}
            onClick={() =>
              mutate((c) => {
                c.bindings = c.bindings || [];
                c.bindings.push({
                  type: 'route',
                  agentId: defaultAgent,
                  match: { channel: Object.keys(channels)[0] || 'telegram' },
                });
              })
            }
          >
            ＋ Add binding
          </button>
        }
      >
        {routeBindings.length === 0 ? (
          <Callout kind="info">
            No bindings — every channel currently goes to your default agent{' '}
            <b>★ {defaultAgent}</b>. Add a binding to send, say, Telegram to a different agent.
          </Callout>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Account (optional)</th>
                <th>→ Agent</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {routeBindings.map(({ b, i }) => (
                <tr key={i}>
                  <td>
                    <select
                      value={b.match?.channel || ''}
                      onChange={(e) =>
                        setBinding(i, (x) => {
                          x.match = x.match || {};
                          x.match.channel = e.target.value;
                        })
                      }
                    >
                      {[...new Set([...Object.keys(channels), ...CHANNEL_TYPES])].map((c) => (
                        <option key={c} value={c}>
                          {c}
                          {channels[c] ? ' ✓' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="any account"
                      value={b.match?.accountId || ''}
                      onChange={(e) =>
                        setBinding(i, (x) => {
                          x.match = x.match || {};
                          if (e.target.value.trim()) x.match.accountId = e.target.value.trim();
                          else delete x.match.accountId;
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={b.agentId || ''}
                      onChange={(e) => setBinding(i, (x) => (x.agentId = e.target.value))}
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id}
                          {a.default ? ' ★' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn sm danger"
                      title="Remove binding"
                      onClick={() =>
                        mutate((c) => {
                          c.bindings.splice(i, 1);
                          if (!c.bindings.length) delete c.bindings;
                        })
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Learn title="How routing decides who answers">
          <p>
            When a message arrives, the Gateway checks your <code>bindings</code> for a matching
            channel (and account, if set). The bound agent gets the conversation — its own
            workspace, model, and memory. No match? The <b>★ default agent</b> picks it up. This
            is how you give Telegram to a fast everyday agent while keeping a heavyweight model
            for direct work: one Gateway, different brains per channel. The CLI equivalent is{' '}
            <code>openclaw agents bind --agent &lt;id&gt; --bind &lt;channel&gt;</code>.
          </p>
        </Learn>
      </Section>

      {adding && (
        <Modal
          title="Add channel"
          onClose={() => setAdding(null)}
          footer={
            <>
              <button className="btn" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!!channels[adding.type] || (adding.type === 'telegram' && !adding.botToken?.trim())}
                onClick={addChannel}
              >
                Add (review before saving)
              </button>
            </>
          }
        >
          <Field label="Channel type">
            <select
              value={adding.type}
              onChange={(e) => setAdding((s) => ({ ...s, type: e.target.value }))}
            >
              {CHANNEL_TYPES.map((c) => (
                <option key={c} value={c} disabled={!!channels[c]}>
                  {c}
                  {channels[c] ? ' (already configured)' : ''}
                </option>
              ))}
            </select>
          </Field>
          {adding.type === 'telegram' ? (
            <>
              <Field
                label="Bot token"
                hint={
                  <>
                    From <code>@BotFather</code> → <code>/newbot</code>. Looks like{' '}
                    <code>123456:ABC-DEF…</code>
                  </>
                }
              >
                <input
                  type="password"
                  placeholder="123456:ABC-DEF…"
                  value={adding.botToken || ''}
                  onChange={(e) => setAdding((s) => ({ ...s, botToken: e.target.value }))}
                />
              </Field>
              <Field label="Display name (optional)">
                <input
                  type="text"
                  placeholder="My OpenClaw bot"
                  value={adding.name || ''}
                  onChange={(e) => setAdding((s) => ({ ...s, name: e.target.value }))}
                />
              </Field>
              <Callout kind="info">
                The channel is added with the safe <code>pairing</code> DM policy — you'll approve
                the first message from each sender. You can loosen that after it's saved.
              </Callout>
            </>
          ) : (
            <Callout kind="warn">
              <b>{adding.type}</b> needs more than a config entry (login flows, QR codes, or local
              daemons). This adds the enabled entry; finish the connection in a terminal with{' '}
              <code>openclaw channels add --channel {adding.type}</code>
              {adding.type === 'whatsapp' && (
                <>
                  {' '}
                  then <code>openclaw channels login --channel whatsapp</code> to scan the QR code
                </>
              )}
              .
            </Callout>
          )}
        </Modal>
      )}
    </>
  );
}

function TelegramForm({ ch, set, shown, toggleShown }) {
  return (
    <>
      <div className="grid-2">
        <Field
          label="Bot token"
          hint="The secret from @BotFather. Anyone with it can impersonate your bot."
        >
          <div className="row">
            <input
              type={shown ? 'text' : 'password'}
              value={ch.botToken || ''}
              onChange={(e) => set((c) => (c.botToken = e.target.value))}
            />
            <button className="btn sm" onClick={toggleShown}>
              {shown ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        <Field label="Display name" hint="Just a label for this account in logs and status output.">
          <input
            type="text"
            value={ch.name || ''}
            onChange={(e) => set((c) => (c.name = e.target.value))}
          />
        </Field>
      </div>
      <Field
        label="DM policy"
        hint="Who may start a direct conversation with your bot. pairing is the safe default — every new sender needs a one-time approval."
      >
        <select
          value={ch.dmPolicy || 'pairing'}
          onChange={(e) => set((c) => (c.dmPolicy = e.target.value))}
        >
          {DM_POLICIES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {(ch.dmPolicy || 'pairing') !== 'open' && (
        <Field
          label="Allow list"
          hint="Telegram user IDs or @usernames, one per line. With pairing, these skip the approval step; with allowlist, only these get through."
        >
          <textarea
            rows={2}
            placeholder="@yourusername"
            value={(ch.allowFrom || []).join('\n')}
            onChange={(e) =>
              set((c) => {
                const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                if (arr.length) c.allowFrom = arr;
                else delete c.allowFrom;
              })
            }
          />
        </Field>
      )}
      {(ch.dmPolicy || 'pairing') === 'open' && (
        <Callout kind="danger">
          ⚠️ <code>open</code> lets anyone on Telegram who finds your bot talk to your agent — and
          your agent may have tools that touch this machine. Prefer <code>pairing</code>.
        </Callout>
      )}
    </>
  );
}

function GenericChannelForm({ name, ch, set, shownSecrets, setShownSecrets }) {
  const entries = Object.entries(ch).filter(([k]) => k !== 'enabled');
  return (
    <>
      {entries.length === 0 && (
        <p className="muted small">
          No settings stored yet — run <code>openclaw channels add --channel {name}</code> in a
          terminal to complete setup.
        </p>
      )}
      <div className="grid-2">
        {entries.map(([k, v]) => {
          const secretKey = `${name}.${k}`;
          if (typeof v === 'boolean')
            return (
              <Field key={k} label={k}>
                <Toggle checked={v} onChange={(nv) => set((c) => (c[k] = nv))} />
              </Field>
            );
          if (typeof v === 'string' || typeof v === 'number')
            return (
              <Field key={k} label={k}>
                <div className="row">
                  <input
                    type={isSecretKey(k) && !shownSecrets[secretKey] ? 'password' : 'text'}
                    value={String(v)}
                    onChange={(e) =>
                      set((c) => (c[k] = typeof v === 'number' ? Number(e.target.value) : e.target.value))
                    }
                  />
                  {isSecretKey(k) && (
                    <button
                      className="btn sm"
                      onClick={() => setShownSecrets((s) => ({ ...s, [secretKey]: !s[secretKey] }))}
                    >
                      {shownSecrets[secretKey] ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>
              </Field>
            );
          if (Array.isArray(v) && v.every((x) => typeof x === 'string'))
            return (
              <Field key={k} label={k} hint="One entry per line.">
                <textarea
                  rows={2}
                  value={v.join('\n')}
                  onChange={(e) =>
                    set((c) => (c[k] = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)))
                  }
                />
              </Field>
            );
          return (
            <Field key={k} label={k} hint="Complex value — edit via CLI or config file.">
              <input type="text" disabled value={JSON.stringify(v)} />
            </Field>
          );
        })}
      </div>
    </>
  );
}
