import { execFile, spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOME } from './config-store.js';

// ---------------------------------------------------------------------------
// Locating a working `openclaw` + matching `node`.
//
// PATH lookups for "openclaw" and "node" are resolved independently: if a
// version manager (nvm, etc.) has an older Node ahead of the one openclaw was
// installed under, `#!/usr/bin/env node` on the openclaw script silently
// picks the wrong Node and fails a version check, even though `openclaw`
// itself resolved to the right file. We resolve openclaw's real path once,
// then always invoke it as `<that dir>/node <that dir>/openclaw ...args`
// so we never depend on `env node` picking the right one.
// ---------------------------------------------------------------------------

let cliPromise;

function tryRun(nodeBin, openclawBin) {
  return new Promise((resolve) => {
    execFile(nodeBin, [openclawBin, '-V'], { timeout: 8000 }, (err, stdout = '') => {
      resolve(!err && /OpenClaw/i.test(stdout) ? { nodeBin, openclawBin } : null);
    });
  });
}

async function resolveCli() {
  // 1. Plain PATH lookup — works when there's no version-manager mismatch.
  const bare = await tryRun('node', 'openclaw');
  if (bare) return { nodeBin: 'node', openclawBin: 'openclaw' };

  // 2. Find openclaw's real file, then use the Node next to it explicitly.
  const whichBin = await new Promise((resolve) => {
    execFile('/usr/bin/which', ['openclaw'], { timeout: 5000 }, (err, stdout = '') =>
      resolve(err ? null : stdout.trim() || null)
    );
  });
  if (whichBin) {
    // Node lives alongside openclaw in the same bin/ dir (not the symlink's
    // resolved target dir, which is usually lib/node_modules/openclaw/).
    const dir = path.dirname(whichBin);
    const candidate = await tryRun(path.join(dir, 'node'), whichBin);
    if (candidate) return candidate;
  }

  // 3. Last resort: scan nvm-installed Node versions for one with openclaw.
  const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
  const versionsDir = path.join(nvmDir, 'versions', 'node');
  let versions = [];
  try {
    versions = fs.readdirSync(versionsDir).sort().reverse();
  } catch {
    /* no nvm install */
  }
  for (const v of versions) {
    const dir = path.join(versionsDir, v, 'bin');
    const openclawBin = path.join(dir, 'openclaw');
    if (!fs.existsSync(openclawBin)) continue;
    const candidate = await tryRun(path.join(dir, 'node'), openclawBin);
    if (candidate) return candidate;
  }

  return null; // openclaw CLI not found anywhere usable
}

function getCli() {
  if (!cliPromise) cliPromise = resolveCli();
  return cliPromise;
}

// Runs `openclaw <args>`, resolving a working node+openclaw pair first.
// Callback-style to match Node's execFile signature.
async function execOpenclaw(args, options, callback) {
  const cli = await getCli();
  if (!cli) return callback(new Error('openclaw CLI not found'), '', '');
  execFile(cli.nodeBin, [cli.openclawBin, ...args], options, callback);
}

function execOpenclawP(args, timeout) {
  return new Promise((resolve) => {
    execOpenclaw(args, { timeout }, (err, stdout = '', stderr = '') => {
      resolve({ ok: !err, output: `${stdout}\n${stderr}`.trim() });
    });
  });
}

let cachedVersion;

export function getVersion() {
  if (cachedVersion) return Promise.resolve(cachedVersion);
  return new Promise((resolve) => {
    execOpenclaw(['-V'], { timeout: 15000 }, (err, stdout) => {
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
    execOpenclaw(
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
    execOpenclaw(
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

// ---------------------------------------------------------------------------
// Gateway start/stop
//
// The Gateway can be run two ways: as an installed launchd/systemd service
// (`openclaw gateway install`, then start/stop), or as a plain foreground
// process (`openclaw gateway run`). This UI never installs the service on its
// own — that's a persistent, login-time system change the user should opt
// into via the CLI. If a service is already installed, Start/Stop drive it
// with the CLI's own service commands. Otherwise, Start spawns a detached
// `openclaw gateway run` process and tracks its pid so Stop can find it again
// even across UI server restarts.
// ---------------------------------------------------------------------------

const PID_FILE = path.join(HOME, 'ui-gateway.pid');
const RUN_LOG = path.join(HOME, 'ui-gateway.log');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await sleep(intervalMs);
  }
  return false;
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // exists but owned by someone else — still alive
  }
}

// Pid of a gateway process this UI spawned itself, if it's still running.
function readManagedPid() {
  let pid;
  try {
    pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
  } catch {
    return null;
  }
  if (!pid || !isPidAlive(pid)) {
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      /* already gone */
    }
    return null;
  }
  return pid;
}

export function getServiceStatus() {
  return new Promise((resolve) => {
    execOpenclaw(
      ['gateway', 'status', '--json', '--no-probe'],
      { timeout: 15000 },
      (err, stdout = '') => {
        if (err) return resolve(null);
        try {
          const data = JSON.parse(stdout);
          resolve({
            installed: data.service?.command != null,
            loaded: !!data.service?.loaded,
            runtimeStatus: data.service?.runtime?.status ?? null,
          });
        } catch {
          resolve(null);
        }
      }
    );
  });
}

export async function getGatewayInfo(port) {
  const [up, service] = await Promise.all([probePort(port), getServiceStatus()]);
  return {
    up,
    serviceInstalled: service?.installed ?? null,
    serviceLoaded: service?.loaded ?? null,
    managedPid: readManagedPid(),
    logFile: RUN_LOG,
  };
}

export async function startGateway(port) {
  if (await probePort(port)) return { ok: true, alreadyRunning: true, mode: 'external' };

  const service = await getServiceStatus();
  if (service?.installed) {
    const result = await execOpenclawP(['gateway', 'start', '--json'], 20000);
    const up = await waitFor(() => probePort(port), 10000);
    return { ok: up, mode: 'service', output: result.output };
  }

  const cli = await getCli();
  if (!cli) return { ok: false, mode: 'foreground', error: 'openclaw CLI not found' };

  let fd;
  try {
    fd = fs.openSync(RUN_LOG, 'a');
  } catch (err) {
    return { ok: false, mode: 'foreground', error: `Could not open log file: ${err.message}` };
  }
  const child = spawn(cli.nodeBin, [cli.openclawBin, 'gateway', 'run'], {
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  child.unref();
  fs.closeSync(fd);
  fs.writeFileSync(PID_FILE, String(child.pid));

  const up = await waitFor(() => probePort(port), 10000);
  if (!up) {
    return {
      ok: false,
      mode: 'foreground',
      error: `Gateway didn't come up within 10s — check ${RUN_LOG}`,
    };
  }
  return { ok: true, mode: 'foreground', pid: child.pid };
}

export async function stopGateway(port) {
  if (!(await probePort(port))) {
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      /* nothing to clean up */
    }
    return { ok: true, alreadyStopped: true };
  }

  const managedPid = readManagedPid();
  if (managedPid) {
    try {
      process.kill(managedPid, 'SIGTERM');
    } catch {
      /* already exiting */
    }
    let down = await waitFor(async () => !(await probePort(port)), 6000);
    if (!down) {
      try {
        process.kill(managedPid, 'SIGKILL');
      } catch {
        /* already exiting */
      }
      down = await waitFor(async () => !(await probePort(port)), 4000);
    }
    if (down) {
      try {
        fs.unlinkSync(PID_FILE);
      } catch {
        /* already gone */
      }
    }
    return { ok: down, mode: 'foreground' };
  }

  const service = await getServiceStatus();
  if (service?.loaded) {
    const result = await execOpenclawP(['gateway', 'stop', '--json'], 20000);
    const down = await waitFor(async () => !(await probePort(port)), 10000);
    return { ok: down, mode: 'service', output: result.output };
  }

  return {
    ok: false,
    mode: 'external',
    error: `Gateway is running on port ${port} but wasn't started by this UI and isn't an installed service. Stop it manually, e.g.: lsof -ti :${port} | xargs kill`,
  };
}
