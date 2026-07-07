import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// OPENCLAW_HOME lets tests (or non-default installs) point at another state dir.
const HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
export const CONFIG_PATH = path.join(HOME, 'openclaw.json');
export const BACKUP_DIR = path.join(HOME, 'config-backups');

export function readConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const stat = fs.statSync(CONFIG_PATH);
  return { config: JSON.parse(raw), raw, path: CONFIG_PATH, mtimeMs: stat.mtimeMs };
}

export function serialize(config) {
  return JSON.stringify(config, null, 2) + '\n';
}

export function backupCurrent() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `openclaw-${stamp}.json`);
  fs.copyFileSync(CONFIG_PATH, dest);
  return dest;
}

export function writeConfig(next) {
  if (!next || typeof next !== 'object' || Array.isArray(next)) {
    throw new Error('Config must be a JSON object');
  }
  const backup = backupCurrent();
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, serialize(next));
  fs.renameSync(tmp, CONFIG_PATH);
  return { backup };
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^openclaw-.*\.json$/.test(f))
    .map((f) => {
      const s = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: s.size, mtimeMs: s.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function readBackup(name) {
  assertBackupName(name);
  return fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8');
}

export function restoreBackup(name) {
  assertBackupName(name);
  const src = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(src)) throw new Error('Backup not found');
  JSON.parse(fs.readFileSync(src, 'utf8')); // refuse to restore a corrupt file
  const backup = backupCurrent();
  fs.copyFileSync(src, CONFIG_PATH);
  return { backup };
}

function assertBackupName(name) {
  if (!/^openclaw-[\w.-]+\.json$/.test(name)) throw new Error('Invalid backup name');
}
