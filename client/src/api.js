async function request(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

const post = (url, data) =>
  request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const getStatus = () => request('/api/status');
export const getConfig = () => request('/api/config');
export const previewConfig = (next) => post('/api/config/preview', { next });
export const applyConfig = (next, expectedMtimeMs) =>
  post('/api/config', { next, expectedMtimeMs });
export const getBackups = () => request('/api/backups');
export const restoreBackup = (name) => post(`/api/backups/${encodeURIComponent(name)}/restore`, {});
export const sendChat = (agentId, message, thinking) =>
  post('/api/chat', { agentId, message, thinking });
