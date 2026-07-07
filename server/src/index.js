import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTwoFilesPatch } from 'diff';
import {
  CONFIG_PATH,
  readConfig,
  serialize,
  writeConfig,
  listBackups,
  readBackup,
  restoreBackup,
} from './config-store.js';
import { getVersion, probePort, runAgentTurn, validateConfig } from './openclaw.js';

const app = express();
app.use(express.json({ limit: '4mb' }));

// deliberately not the generic PORT: dev launchers set PORT for the Vite client
const PORT = Number(process.env.OPENCLAW_UI_PORT || 4177);

app.get('/api/status', async (_req, res) => {
  try {
    const { config, path: configPath, mtimeMs } = readConfig();
    const gw = config.gateway || {};
    const port = Number(gw.port || 18789);
    const [version, gatewayUp] = await Promise.all([getVersion(), probePort(port)]);
    const agents = config.agents?.list || [];
    res.json({
      version,
      configPath,
      mtimeMs,
      agentCount: agents.length,
      defaultAgent: (agents.find((a) => a.default) || agents[0])?.id ?? null,
      gateway: {
        up: gatewayUp,
        port,
        mode: gw.mode ?? 'local',
        bind: gw.bind ?? 'loopback',
        authMode: gw.auth?.mode ?? 'none',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config', (_req, res) => {
  try {
    const { config, path: configPath, mtimeMs } = readConfig();
    res.json({ config, path: configPath, mtimeMs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/preview', async (req, res) => {
  try {
    const next = req.body?.next;
    if (!next || typeof next !== 'object') throw new Error('Missing "next" config object');
    const current = readConfig();
    const before = serialize(current.config);
    const after = serialize(next);
    const patch = createTwoFilesPatch(
      'openclaw.json (current)',
      'openclaw.json (proposed)',
      before,
      after,
      undefined,
      undefined,
      { context: 3 }
    );
    const changed = before !== after;
    const validation = changed ? await validateConfig(after) : { ok: true };
    res.json({ changed, patch, validation });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const next = req.body?.next;
    if (!next || typeof next !== 'object') throw new Error('Missing "next" config object');
    const expected = req.body?.expectedMtimeMs;
    const current = readConfig();
    if (expected && Math.abs(current.mtimeMs - expected) > 1) {
      return res.status(409).json({
        error: 'Config changed on disk since you loaded it. Reload before saving.',
      });
    }
    const { backup } = writeConfig(next);
    const fresh = readConfig();
    res.json({ ok: true, backup, mtimeMs: fresh.mtimeMs, config: fresh.config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups', (_req, res) => {
  try {
    res.json({ backups: listBackups() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups/:name', (req, res) => {
  try {
    res.type('application/json').send(readBackup(req.params.name));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/backups/:name/restore', (req, res) => {
  try {
    const { backup } = restoreBackup(req.params.name);
    const fresh = readConfig();
    res.json({ ok: true, backup, mtimeMs: fresh.mtimeMs, config: fresh.config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { agentId, message, thinking } = req.body || {};
  if (!agentId || !message) {
    return res.status(400).json({ error: 'agentId and message are required' });
  }
  const out = await runAgentTurn({ agentId, message, thinking });
  res.json(out);
});

// In production, serve the built client from the same port.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`openclaw-ui server on http://127.0.0.1:${PORT} (config: ${CONFIG_PATH})`);
});
