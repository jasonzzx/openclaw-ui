import React from 'react';

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
const basename = (p) => (p ? p.split('/').filter(Boolean).pop() : '');

/**
 * Live architecture diagram built from the actual config:
 * Channels → Gateway (status, port, auth, bind) → Agents (model, workspace),
 * with Plugins / Tools / Skills hanging off the Gateway.
 */
export default function ArchDiagram({ config, status, onNavigate }) {
  const agents = config?.agents?.list || [];
  const defaults = config?.agents?.defaults || {};
  const gw = config?.gateway || {};
  const pluginCount = Object.keys(config?.plugins?.entries || {}).length;
  const toolsProfile = config?.tools?.profile || 'default';
  const up = status?.gateway?.up;

  const AH = 66; // agent box height
  const AGAP = 14;
  const agentsTotal = Math.max(agents.length, 1) * AH + (Math.max(agents.length, 1) - 1) * AGAP;
  const colH = Math.max(agentsTotal, 160);
  const top = 46;
  const cy = top + colH / 2;
  const chipY = top + colH + 30;
  const H = chipY + 34 + 16;

  const agentOffset = top + (colH - agentsTotal) / 2;

  const effModel = (a) => a.model?.primary || defaults.model?.primary || '—';
  const effWorkspace = (a) => a.workspace || defaults.workspace || '';

  return (
    <div className="diagram-wrap">
      <svg className="diagram" viewBox={`0 0 920 ${H}`} width="920" height={H}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="var(--faint)" />
          </marker>
        </defs>

        {/* column labels */}
        <text className="diag-label" x="100" y="24" textAnchor="middle">
          Channels
        </text>
        <text className="diag-label" x="460" y="24" textAnchor="middle">
          Gateway
        </text>
        <text className="diag-label" x="792" y="24" textAnchor="middle">
          Agents
        </text>

        {/* channels */}
        <rect className="diag-box" x="15" y={cy - 70} width="170" height="140" rx="10" />
        <text className="diag-title" x="100" y={cy - 46} textAnchor="middle">
          💬 Chat apps
        </text>
        <text className="diag-text" x="100" y={cy - 22} textAnchor="middle">
          WhatsApp · Telegram
        </text>
        <text className="diag-text" x="100" y={cy - 4} textAnchor="middle">
          Discord · iMessage
        </text>
        <text className="diag-text" x="100" y={cy + 14} textAnchor="middle">
          Slack · Signal · CLI…
        </text>
        <text className="diag-mono" x="100" y={cy + 44} textAnchor="middle">
          your messages arrive here
        </text>

        {/* channels -> gateway */}
        <line className="diag-arrow" x1="185" y1={cy} x2="343" y2={cy} />
        <text className="diag-text" x="264" y={cy - 10} textAnchor="middle">
          incoming messages
        </text>

        {/* gateway */}
        <rect
          className="diag-box accent clickable"
          x="350"
          y={cy - 58}
          width="220"
          height="116"
          rx="10"
          onClick={() => onNavigate('gateway')}
        />
        <circle cx="552" cy={cy - 40} r="5" fill={up ? 'var(--ok)' : 'var(--danger)'}>
          {up && <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />}
        </circle>
        <text
          className="diag-title"
          x="460"
          y={cy - 32}
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          🦞 Gateway
        </text>
        <text className="diag-mono" x="460" y={cy - 8} textAnchor="middle" style={{ pointerEvents: 'none' }}>
          ws://127.0.0.1:{gw.port || 18789}
        </text>
        <text className="diag-mono" x="460" y={cy + 12} textAnchor="middle" style={{ pointerEvents: 'none' }}>
          auth: {gw.auth?.mode || 'none'} · bind: {gw.bind || 'loopback'}
        </text>
        <text className="diag-text" x="460" y={cy + 38} textAnchor="middle" style={{ pointerEvents: 'none' }}>
          routes each session to an agent
        </text>

        {/* gateway -> agents */}
        {agents.map((a, i) => {
          const ay = agentOffset + i * (AH + AGAP) + AH / 2;
          return (
            <path
              key={a.id}
              className="diag-arrow"
              d={`M570,${cy} C 622,${cy} 626,${ay} 673,${ay}`}
            />
          );
        })}

        {/* agents */}
        {agents.map((a, i) => {
          const ay = agentOffset + i * (AH + AGAP);
          return (
            <g key={a.id} onClick={() => onNavigate('agents')}>
              <rect className="diag-box clickable" x="680" y={ay} width="225" height={AH} rx="10" />
              <text className="diag-title" x="694" y={ay + 22} style={{ pointerEvents: 'none' }}>
                🤖 {a.id}
                {a.default ? ' ★' : ''}
              </text>
              <text className="diag-mono" x="694" y={ay + 40} style={{ pointerEvents: 'none' }}>
                {trunc(effModel(a), 32)}
              </text>
              <text className="diag-mono" x="694" y={ay + 56} style={{ pointerEvents: 'none' }}>
                📁 {trunc(basename(effWorkspace(a)), 28)}
              </text>
            </g>
          );
        })}

        {/* gateway -> capability chips */}
        <line
          className="diag-arrow dashed"
          x1="460"
          y1={cy + 58}
          x2="460"
          y2={chipY - 6}
          markerEnd="none"
        />
        {[
          { x: 275, label: `🧩 Plugins (${pluginCount})`, page: 'plugins' },
          { x: 405, label: `🛠 Tools: ${trunc(toolsProfile, 10)}`, page: 'gateway' },
          { x: 535, label: '📚 Skills', page: 'plugins' },
        ].map((chip) => (
          <g key={chip.label} onClick={() => onNavigate(chip.page)}>
            <rect className="diag-box clickable" x={chip.x} y={chipY} width="120" height="30" rx="15" />
            <text
              className="diag-text"
              x={chip.x + 60}
              y={chipY + 19}
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {chip.label}
            </text>
          </g>
        ))}
        <text className="diag-text" x="672" y={chipY + 19}>
          ← capabilities agents can use
        </text>
      </svg>
    </div>
  );
}
