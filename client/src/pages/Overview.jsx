import React from 'react';
import { Section, Learn, StatusPill } from '../components/ui.jsx';
import ArchDiagram from '../components/ArchDiagram.jsx';

export default function Overview({ config, status, go }) {
  const agents = config.agents?.list || [];
  const gw = config.gateway || {};

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <p className="page-desc">
        A live map of your OpenClaw installation. Everything below is read from{' '}
        <code>{status?.configPath || '~/.openclaw/openclaw.json'}</code> — the single source of
        truth for your whole setup. Click any box in the diagram to jump to its settings.
      </p>

      <div className="stat-grid">
        <div className="stat">
          <div className="k">OpenClaw version</div>
          <div className="v">{status?.version || '—'}</div>
        </div>
        <div className="stat">
          <div className="k">Gateway</div>
          <div className="v">
            <StatusPill ok={!!status?.gateway?.up} />
            <span className="kv-inline mono">:{gw.port || 18789}</span>
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => go('gateway')}>
              {status?.gateway?.up ? 'Manage' : 'Start →'}
            </button>
          </div>
        </div>
        <div className="stat">
          <div className="k">Agents</div>
          <div className="v">
            {agents.length}
            <span className="kv-inline">★ {status?.defaultAgent || agents[0]?.id || '—'}</span>
          </div>
        </div>
        <div className="stat">
          <div className="k">Channels</div>
          <div className="v">
            {Object.keys(config.channels || {}).length}
            <span className="kv-inline">
              {Object.values(config.channels || {}).filter((c) => c.enabled !== false).length}{' '}
              enabled
            </span>
          </div>
        </div>
        <div className="stat">
          <div className="k">Tools profile</div>
          <div className="v">{config.tools?.profile || 'default'}</div>
        </div>
      </div>

      <Section
        title="Architecture — how a message flows through OpenClaw"
        subtitle="Built live from your config. Solid arrows are message flow; the dashed line shows capabilities the Gateway exposes to agents."
      >
        <ArchDiagram config={config} status={status} onNavigate={go} />
      </Section>

      <Learn title="The three big ideas in OpenClaw" open>
        <p>
          <b>1. The Gateway is the always-on hub.</b> It's a single WebSocket server (yours listens
          on port {gw.port || 18789}) that connects your chat channels, schedules cron jobs, and
          dispatches every conversation. Channels don't talk to models directly — everything goes
          through the Gateway. If the Gateway is down, nothing responds.
        </p>
        <p>
          <b>2. Agents are isolated workers.</b> Each agent has its own <i>workspace</i> (a folder
          that acts as its memory and file sandbox) and its own <i>model</i> configuration. You
          might keep a fast/cheap agent for everyday chat and a powerful one for hard problems —
          that's exactly what your <code>{agents[0]?.id || 'main'}</code>
          {agents[1] ? ` and ${agents[1].id} agents do` : ' agent does'}. The ★ default agent
          receives messages that aren't routed anywhere specific.
        </p>
        <p>
          <b>3. Everything is one JSON file.</b> All of this lives in{' '}
          <code>openclaw.json</code>. This UI edits that file with a review-diff and automatic
          backups, so you can always see exactly what changed and roll back. The equivalent CLI is{' '}
          <code>openclaw config set/get</code>.
        </p>
      </Learn>

      <div className="grid-2">
        <Section title="🤖 Manage agents" subtitle="Create agents, set models and workspaces, choose the default.">
          <button className="btn" onClick={() => go('agents')}>
            Open Agents →
          </button>
        </Section>
        <Section
          title="✈️ Connect a chat app"
          subtitle="Hook up Telegram & friends and route each channel to an agent."
        >
          <button className="btn" onClick={() => go('channels')}>
            Open Channels →
          </button>
        </Section>
        <Section title="💬 Test an agent" subtitle="Send a real message through the Gateway and inspect the reply.">
          <button className="btn" onClick={() => go('chat')}>
            Open Chat Console →
          </button>
        </Section>
      </div>
    </>
  );
}
