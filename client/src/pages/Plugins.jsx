import React, { useState } from 'react';
import { Section, Field, Learn, Callout, Toggle, Badge } from '../components/ui.jsx';

export default function Plugins({ config, mutate }) {
  const entries = config.plugins?.entries || {};
  const profiles = config.auth?.profiles || {};
  const [newPlugin, setNewPlugin] = useState('');

  return (
    <>
      <h1 className="page-title">Plugins, Skills & Auth</h1>
      <p className="page-desc">
        Three different ways OpenClaw gains abilities — it's easy to mix them up, so here's the
        short version: <b>plugins</b> add integrations (channels, model providers),{' '}
        <b>skills</b> teach agents how to do tasks, and <b>auth profiles</b> hold the credentials
        that providers need.
      </p>

      <Learn title="Plugins vs. skills — what's the difference?" open>
        <ul>
          <li>
            <b>Plugins</b> extend the <i>platform</i>: they add chat channels (WhatsApp,
            Telegram…), model providers (like your <code>google</code> plugin), and other
            infrastructure. They run inside the Gateway. Manage them here or with{' '}
            <code>openclaw plugins</code>.
          </li>
          <li>
            <b>Skills</b> extend the <i>agents</i>: a skill is a folder of instructions (and
            sometimes scripts) that an agent reads when a task matches — e.g. a "make slides"
            skill. Installed ones live in <code>~/.openclaw/plugin-skills/</code>; browse with{' '}
            <code>openclaw skills list</code>.
          </li>
          <li>
            <b>Auth profiles</b> are named credential slots (API keys or OAuth) that plugins use
            to talk to providers — so your key is stored once, not sprinkled through the config.
          </li>
        </ul>
      </Learn>

      <Section
        title={`Plugins (${Object.keys(entries).length})`}
        subtitle="Toggling only flips the enabled flag in config — a disabled plugin stays installed but the Gateway won't load it."
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Plugin</th>
              <th>Status</th>
              <th style={{ width: 120 }}>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(entries).map(([name, entry]) => (
              <tr key={name}>
                <td>
                  <b>{name}</b>
                </td>
                <td>
                  {entry?.enabled !== false ? (
                    <Badge kind="ok">active</Badge>
                  ) : (
                    <Badge>disabled</Badge>
                  )}
                </td>
                <td>
                  <Toggle
                    checked={entry?.enabled !== false}
                    onChange={(v) =>
                      mutate((c) => {
                        c.plugins.entries[name] = { ...c.plugins.entries[name], enabled: v };
                      })
                    }
                  />
                </td>
              </tr>
            ))}
            {Object.keys(entries).length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No plugins configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <hr className="sep" />
        <Field
          label="Add plugin entry"
          hint={
            <>
              Adds an enabled entry to <code>plugins.entries</code>. The plugin itself must be
              available to OpenClaw — install channels/providers with{' '}
              <code>openclaw channels add</code> or <code>openclaw plugins install</code>.
            </>
          }
        >
          <div className="row">
            <input
              type="text"
              placeholder="e.g. telegram"
              value={newPlugin}
              onChange={(e) => setNewPlugin(e.target.value)}
            />
            <button
              className="btn"
              disabled={!newPlugin.trim() || entries[newPlugin.trim()]}
              onClick={() => {
                mutate((c) => {
                  c.plugins = c.plugins || {};
                  c.plugins.entries = c.plugins.entries || {};
                  c.plugins.entries[newPlugin.trim()] = { enabled: true };
                });
                setNewPlugin('');
              }}
            >
              ＋ Add
            </button>
          </div>
        </Field>
      </Section>

      <Section
        title={`Auth profiles (${Object.keys(profiles).length})`}
        subtitle="Read-only here on purpose: the actual secrets live in OpenClaw's credential store, not in openclaw.json."
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Provider</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(profiles).map(([id, p]) => (
              <tr key={id}>
                <td>
                  <code>{id}</code>
                </td>
                <td>{p.provider}</td>
                <td>
                  <Badge kind="blue">{p.mode}</Badge>
                </td>
              </tr>
            ))}
            {Object.keys(profiles).length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No auth profiles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Callout kind="info">
          To add or change provider credentials safely (API keys, OAuth), run{' '}
          <code>openclaw configure</code> in a terminal — it stores secrets in the credential
          store and updates these profile entries for you.
        </Callout>
      </Section>

      <Section title="Skills installer" subtitle="How OpenClaw installs skills that need Node.js dependencies.">
        <Field label="Node package manager (skills.install.nodeManager)">
          <select
            value={config.skills?.install?.nodeManager || 'npm'}
            onChange={(e) =>
              mutate((c) => {
                c.skills = c.skills || {};
                c.skills.install = c.skills.install || {};
                c.skills.install.nodeManager = e.target.value;
              })
            }
          >
            {['npm', 'pnpm', 'bun'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </Section>
    </>
  );
}
