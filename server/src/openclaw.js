import { execFile } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let cachedVersion;

export function getVersion() {
  if (cachedVersion) return Promise.resolve(cachedVersion);
  return new Promise((resolve) => {
    execFile('openclaw', ['-V'], { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve(null);
      // output looks like "OpenClaw 2026.5.12 (f066dd2)" — keep just the version part
      cachedVersion = stdout.trim().replace(/^OpenClaw\s+/i, '');
      resolve(cachedVersion);
    });
  });
}

export function probePort(port, host = '127.0.0.1', timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    const done = (up) => {
      sock.destroy();
      resolve(up);
    };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.on('connect', () => done(true));
    sock.on('error', () => done(false));
  });
}

// Checks a proposed config against OpenClaw's own validator without touching
// the real file: writes it to a temp state dir and runs `openclaw config validate`.
// Resolves { ok, output? } or null when the openclaw CLI is unavailable.
export function validateConfig(serialized) {
  return new Promise((resolve) => {
    let dir;
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-ui-validate-'));
      fs.writeFileSync(path.join(dir, 'openclaw.json'), serialized);
    } catch {
      return resolve(null);
    }
    execFile(
      'openclaw',
      ['config', 'validate'],
      {
        timeout: 30000,
        env: {
          ...process.env,
          OPENCLAW_STATE_DIR: dir,
          OPENCLAW_CONFIG_PATH: path.join(dir, 'openclaw.json'),
        },
      },
      (err, stdout = '', stderr = '') => {
        fs.rmSync(dir, { recursive: true, force: true });
        if (err && err.code === 'ENOENT') return resolve(null);
        // eslint-disable-next-line no-control-regex
        const output = `${stdout}\n${stderr}`.replace(/\x1b\[[0-9;]*m/g, '').trim();
        if (!err && /Config valid/i.test(output)) return resolve({ ok: true });
        resolve({ ok: false, output: output.slice(0, 4000) });
      }
    );
  });
}

// Runs one agent turn through the OpenClaw Gateway via the CLI.
export function runAgentTurn({ agentId, message, thinking }) {
  const args = ['agent', '--agent', agentId, '--message', message, '--json'];
  if (thinking && thinking !== 'default') args.push('--thinking', thinking);
  return new Promise((resolve) => {
    execFile(
      'openclaw',
      args,
      { timeout: 300000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout = '', stderr = '') => {
        const result = extractJson(stdout);
        resolve({
          ok: !err,
          error: err ? firstLine(err.message) : null,
          text: extractReplyText(result) ?? (stdout.trim() || null),
          result,
          stderr: stderr.trim() || null,
        });
      }
    );
  });
}

function firstLine(s) {
  return String(s).split('\n')[0];
}

// The CLI may print a banner before the JSON document; grab the outermost braces.
function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function extractReplyText(result) {
  if (!result) return null;
  const payloads = result.payloads || result.result?.payloads;
  if (Array.isArray(payloads)) {
    const texts = payloads.map((p) => p?.text).filter(Boolean);
    if (texts.length) return texts.join('\n\n');
  }
  for (const key of ['text', 'reply', 'message', 'content', 'output']) {
    if (typeof result[key] === 'string' && result[key].trim()) return result[key];
  }
  return null;
}
