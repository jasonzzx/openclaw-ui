import React, { useMemo, useState } from 'react';
import { Section, Field, Badge, Learn, Modal, Callout } from '../components/ui.jsx';

const KNOWN_MODELS = [
  'anthropic/claude-opus-4-8',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4-5',
];

const InheritBadge = ({ overridden }) =>
  overridden ? <Badge kind="accent">override</Badge> : <Badge>inherited</Badge>;

export default function Agents({ config, mutate }) {
  const defaults = config.agents?.defaults || {};
  const agents = config.agents?.list || [];
  const [editing, setEditing] = useState(null); // { original: agent|null, form: {...} }

  const modelSuggestions = useMemo(() => {
    const fromConfig = Object.keys(defaults.models || {});
    const inUse = agents.flatMap((a) => [a.model?.primary, ...(a.model?.fallbacks || [])]);
    return [...new Set([...fromConfig, defaults.model?.primary, ...inUse, ...KNOWN_MODELS])].filter(
      Boolean
    );
  }, [config]);

  const openEditor = (agent) =>
    setEditing({
      original: agent || null,
      form: {
        id: agent?.id || '',
        isDefault: !!agent?.default,
        workspace: agent?.workspace || '',
        primary: agent?.model?.primary || '',
        fallbacks: (agent?.model?.fallbacks || []).join('\n'),
      },
    });

  const saveAgent = () => {
    const { original, form } = editing;
    const id = form.id.trim();
    if (!id) return alert('Agent id is required.');
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id))
      return alert('Agent id should be a simple slug (letters, digits, - or _).');
    if (!original && agents.some((a) => a.id === id))
      return alert(`An agent with id "${id}" already exists.`);

    mutate((c) => {
      c.agents = c.agents || {};
      c.agents.list = c.agents.list || [];
      const list = c.agents.list;
      const entry = original ? list.find((a) => a.id === original.id) : {};
      if (!original) list.push(entry);

      entry.id = id;

      // exactly one default agent at a time
      if (form.isDefault) {
        list.forEach((a) => delete a.default);
        entry.default = true;
      } else {
        delete entry.default;
      }

      // blank = inherit from defaults (key removed entirely)
      if (form.workspace.trim()) entry.workspace = form.workspace.trim();
      else delete entry.workspace;

      const fallbacks = form.fallbacks
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (form.primary.trim() || fallbacks.length) {
        entry.model = {};
        if (form.primary.trim()) entry.model.primary = form.primary.trim();
        if (fallbacks.length) entry.model.fallbacks = fallbacks;
      } else {
        delete entry.model;
      }
    });
    setEditing(null);
  };

  const deleteAgent = (agent) => {
    if (
      !window.confirm(
        `Remove agent "${agent.id}" from the config?\n\nIts workspace folder and session history stay on disk — only the config entry is removed.`
      )
    )
      return;
    mutate((c) => {
      c.agents.list = c.agents.list.filter((a) => a.id !== agent.id);
      // keep exactly one default
      if (agent.default && c.agents.list.length && !c.agents.list.some((a) => a.default)) {
        c.agents.list[0].default = true;
      }
    });
  };

  const setDefaults = (fn) =>
    mutate((c) => {
      c.agents = c.agents || {};
      c.agents.defaults = c.agents.defaults || {};
      fn(c.agents.defaults);
    });

  const aliasRows = Object.entries(defaults.models || {});

  return (
    <>
      <h1 className="page-title">Agents</h1>
      <p className="page-desc">
        Agents are independent AI workers behind one Gateway. Each one resolves its settings in two
        steps: <b>its own overrides</b> win, and anything left blank is <b>inherited from
        defaults</b> — the badges below show which is which.
      </p>

      <Learn title="Defaults vs. overrides — how inheritance works">
        <p>
          <code>agents.defaults</code> is the template every agent starts from. An agent entry in{' '}
          <code>agents.list</code> only needs an <code>id</code>; any field it doesn't set
          (workspace, model…) falls through to the defaults. This keeps the config small: change
          the default model once, and every non-overriding agent follows.
        </p>
        <ul>
          <li>
            <b>Workspace</b> — the agent's home folder. It's the agent's persistent memory
            (notes, files, <code>AGENTS.md</code> instructions) and the sandbox where its tools
            run. Give each agent its own workspace so they don't share memory.
          </li>
          <li>
            <b>Primary model</b> — the model used for every turn, as{' '}
            <code>provider/model-id</code>.
          </li>
          <li>
            <b>Fallbacks</b> — tried in order when the primary fails (rate limit, outage). A
            cheap, reliable fallback keeps your assistant responsive.
          </li>
          <li>
            <b>Aliases</b> — short names for models, so in chat you can say{' '}
            <code>/model pro</code> instead of the full id.
          </li>
        </ul>
      </Learn>

      <Section
        title="Shared defaults"
        subtitle="Every agent inherits these unless it overrides them. Edits here affect all inheriting agents at once."
      >
        <div className="grid-2">
          <Field label="Default workspace" hint="Base folder for agents that don't set their own.">
            <input
              type="text"
              value={defaults.workspace || ''}
              onChange={(e) => setDefaults((d) => (d.workspace = e.target.value))}
            />
          </Field>
          <Field label="Default primary model" hint="Used by every agent without its own model.">
            <input
              type="text"
              list="model-suggestions"
              value={defaults.model?.primary || ''}
              onChange={(e) =>
                setDefaults((d) => {
                  d.model = d.model || {};
                  d.model.primary = e.target.value;
                })
              }
            />
          </Field>
        </div>
        <Field
          label="Default fallback models"
          hint="One per line, tried top to bottom when the primary model errors out."
        >
          <textarea
            rows={2}
            value={(defaults.model?.fallbacks || []).join('\n')}
            onChange={(e) =>
              setDefaults((d) => {
                d.model = d.model || {};
                const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                if (arr.length) d.model.fallbacks = arr;
                else delete d.model.fallbacks;
              })
            }
          />
        </Field>

        <Field
          label="Model aliases"
          hint={
            <>
              Short names usable anywhere a model is referenced (e.g. in chat:{' '}
              <code>/model flash</code>).
            </>
          }
        >
          {aliasRows.map(([modelId, meta]) => (
            <div className="alias-row" key={modelId}>
              <input type="text" value={modelId} disabled />
              <input
                type="text"
                placeholder="alias"
                value={meta?.alias || ''}
                onChange={(e) =>
                  setDefaults((d) => {
                    d.models[modelId] = { ...d.models[modelId], alias: e.target.value };
                  })
                }
              />
              <button
                className="btn sm danger"
                title="Remove alias"
                onClick={() => setDefaults((d) => delete d.models[modelId])}
              >
                ✕
              </button>
            </div>
          ))}
          <AliasAdder
            suggestions={modelSuggestions}
            onAdd={(modelId, alias) =>
              setDefaults((d) => {
                d.models = d.models || {};
                d.models[modelId] = alias ? { alias } : {};
              })
            }
          />
        </Field>
      </Section>

      <Section
        title={`Your agents (${agents.length})`}
        subtitle="★ marks the default agent — it receives any message that isn't explicitly routed to another agent."
      >
        <div className="agent-grid">
          {agents.map((a) => {
            const model = a.model?.primary || defaults.model?.primary;
            const workspace = a.workspace || defaults.workspace;
            return (
              <div key={a.id} className={`agent-card ${a.default ? 'is-default' : ''}`}>
                <div className="head">
                  <span className="aname">🤖 {a.id}</span>
                  {a.default && <Badge kind="accent">★ default</Badge>}
                </div>
                <div className="prop">
                  <span className="pk">model</span>
                  <span className="pv" title={model}>
                    {model || '—'}
                  </span>
                  <InheritBadge overridden={!!a.model?.primary} />
                </div>
                <div className="prop">
                  <span className="pk">workspace</span>
                  <span className="pv" title={workspace}>
                    {workspace || '—'}
                  </span>
                  <InheritBadge overridden={!!a.workspace} />
                </div>
                <div className="prop">
                  <span className="pk">fallbacks</span>
                  <span className="pv">
                    {(a.model?.fallbacks || defaults.model?.fallbacks || []).length || 'none'}
                  </span>
                  <InheritBadge overridden={!!a.model?.fallbacks} />
                </div>
                <div className="actions">
                  <button className="btn sm" onClick={() => openEditor(a)}>
                    Edit
                  </button>
                  <button
                    className="btn sm danger"
                    disabled={agents.length === 1}
                    title={agents.length === 1 ? 'You need at least one agent' : undefined}
                    onClick={() => deleteAgent(a)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          <div className="agent-card new" onClick={() => openEditor(null)}>
            ＋ New agent
          </div>
        </div>
      </Section>

      <datalist id="model-suggestions">
        {modelSuggestions.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {editing && (
        <Modal
          title={editing.original ? `Edit agent “${editing.original.id}”` : 'New agent'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={saveAgent}>
                {editing.original ? 'Update' : 'Create'} (review before saving)
              </button>
            </>
          }
        >
          <Callout kind="info">
            Nothing is written yet — this only edits the draft. You'll review a diff before
            anything touches <code>openclaw.json</code>.
          </Callout>
          <Field
            label="Agent id"
            hint="A short slug used everywhere: routing, CLI (openclaw agent --agent <id>), logs."
          >
            <input
              type="text"
              placeholder="e.g. research"
              value={editing.form.id}
              disabled={!!editing.original}
              onChange={(e) => setEditing((s) => ({ ...s, form: { ...s.form, id: e.target.value } }))}
            />
          </Field>
          <Field
            label={
              <span className="row">
                Default agent
                <input
                  type="checkbox"
                  checked={editing.form.isDefault}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, form: { ...s.form, isDefault: e.target.checked } }))
                  }
                />
              </span>
            }
            hint="The default agent handles unrouted messages. Making this one default un-defaults the others."
          />
          <Field
            label="Workspace"
            hint={
              <>
                Leave blank to inherit <code>{defaults.workspace || 'the default workspace'}</code>.
                Tip: give each agent its own folder, e.g.{' '}
                <code>~/.openclaw/workspace-{editing.form.id || '<id>'}</code>, so agents keep
                separate memory.
              </>
            }
          >
            <input
              type="text"
              placeholder="(inherit from defaults)"
              value={editing.form.workspace}
              onChange={(e) =>
                setEditing((s) => ({ ...s, form: { ...s.form, workspace: e.target.value } }))
              }
            />
          </Field>
          <Field
            label="Primary model"
            hint={
              <>
                Format <code>provider/model-id</code>. Leave blank to inherit{' '}
                <code>{defaults.model?.primary || 'the default model'}</code>.
              </>
            }
          >
            <input
              type="text"
              list="model-suggestions"
              placeholder="(inherit from defaults)"
              value={editing.form.primary}
              onChange={(e) =>
                setEditing((s) => ({ ...s, form: { ...s.form, primary: e.target.value } }))
              }
            />
          </Field>
          <Field
            label="Fallback models"
            hint="One per line. Tried in order when the primary fails — leave empty to inherit."
          >
            <textarea
              rows={3}
              placeholder="(inherit from defaults)"
              value={editing.form.fallbacks}
              onChange={(e) =>
                setEditing((s) => ({ ...s, form: { ...s.form, fallbacks: e.target.value } }))
              }
            />
          </Field>
        </Modal>
      )}
    </>
  );
}

function AliasAdder({ suggestions, onAdd }) {
  const [modelId, setModelId] = useState('');
  const [alias, setAlias] = useState('');
  return (
    <div className="alias-row">
      <input
        type="text"
        list="model-suggestions"
        placeholder="provider/model-id"
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
      />
      <input type="text" placeholder="alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
      <button
        className="btn sm"
        title="Add model alias"
        disabled={!modelId.trim()}
        onClick={() => {
          onAdd(modelId.trim(), alias.trim());
          setModelId('');
          setAlias('');
        }}
      >
        ＋
      </button>
    </div>
  );
}
