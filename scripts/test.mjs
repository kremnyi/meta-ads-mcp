import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Default run: protocol and write-guard checks, no network. --live adds read-only requests to Meta.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live');
const env = live ? process.env : { ...process.env, META_ADS_ENV_FILE: '/nonexistent/meta-ads.env', META_ADS_ACCOUNT_ID: '', META_ADS_ACCESS_TOKEN: '' };
const child = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env, stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map();
let nextId = 1;
readline.createInterface({ input: child.stdout }).on('line', (line) => {
  const response = JSON.parse(line);
  pending.get(response.id)?.(response);
  pending.delete(response.id);
});
const request = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 60_000);
  pending.set(id, (response) => { clearTimeout(timer); resolve(response); });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
});
const call = async (name, args) => (await request('tools/call', { name, arguments: args })).result;
const refused = async (name, args, pattern) => {
  const result = await call(name, args);
  assert.equal(result.isError, true, `${name} must be refused`);
  assert.match(result.content[0].text, pattern);
};
const ok = { change_summary: 'guard test only', user_confirmed: true };

try {
  const init = await request('initialize', { protocolVersion: '2025-06-18' });
  assert.equal(init.result.serverInfo.name, 'meta-ads');
  const { tools } = (await request('tools/list')).result;
  assert.equal(tools.length, 10);

  for (const name of ['create', 'update', 'set_status', 'copy', 'delete']) {
    await refused(name, { id: '1', object_type: 'campaign', status: 'ACTIVE', params: { name: 'x' } }, /explicit action-time user confirmation/);
  }
  await refused('create', { object_type: 'campaign', params: { name: 'x', status: 'ACTIVE' }, ...ok }, /created PAUSED/);
  await refused('update', { id: '1', params: { status: 'ACTIVE' }, ...ok }, /Use set_status/);
  await refused('delete', { id: 'act_1/campaigns', ...ok }, /numeric Meta object ID/);
  await refused('get', { id: '../me' }, /numeric Meta object ID/);
  await refused('list', { edge: 'assigned_users' }, /Unsupported edge/);
  if (!live) await refused('list', { edge: 'campaigns' }, /credentials are missing/);
  console.log('guard checks passed');

  if (live) {
    const status = (await call('auth_status', {})).structuredContent;
    console.log(JSON.stringify({ ...status, user: status.user.error ? status.user : 'ok' }, null, 2));
    assert.equal(status.connected, true, 'token or ad account is not usable');
    const campaigns = await call('list', { edge: 'campaigns', fields: 'id,name,effective_status', limit: 3 });
    assert.notEqual(campaigns.isError, true, campaigns.content?.[0]?.text);
    console.log(`live read passed: ${campaigns.structuredContent.data.length} campaigns returned`);
  }
} finally {
  child.kill();
}
