import readline from 'node:readline';
import { tools, callTool } from './tools.mjs';

const registry = new Map(tools.map((tool) => [tool.name, tool]));

const instructions = 'Meta Marketing API for one configured ad account: campaigns, ad sets, ads, creatives, insights, and Instagram media. Read tools are safe. Every write spends or can spend real money. Before EVERY create, update, copy, status change, or deletion, show the exact change, including budget in account currency, targeting, placements, and status, and obtain explicit user confirmation in the current request. New and copied objects are always PAUSED. Setting ACTIVE needs its own confirmation after the user reviewed the paused object. Budgets are in the minor currency unit. Set user_confirmed only for a specifically approved action; it is not blanket permission. Load the meta-ads skill for campaign recipes.';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleMessage(message) {
  if (Array.isArray(message)) {
    for (const item of message) await handleMessage(item);
    return;
  }
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
    send({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid request' } });
    return;
  }
  if (message.id === undefined) return;
  try {
    let result;
    if (message.method === 'initialize') {
      result = { protocolVersion: message.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'meta-ads', version: '0.2.0' }, instructions };
    } else if (message.method === 'ping') {
      result = {};
    } else if (message.method === 'tools/list') {
      result = { tools };
    } else if (message.method === 'tools/call') {
      if (!registry.has(message.params?.name)) throw Object.assign(new Error('Unknown tool'), { code: -32602 });
      const args = message.params?.arguments ?? {};
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw Object.assign(new Error('Tool arguments must be an object'), { code: -32602 });
      }
      try {
        result = await callTool(message.params.name, args);
      } catch (error) {
        result = { isError: true, content: [{ type: 'text', text: error.message }] };
      }
    } else {
      throw Object.assign(new Error('Method not found'), { code: -32601 });
    }
    send({ jsonrpc: '2.0', id: message.id, result });
  } catch (error) {
    send({ jsonrpc: '2.0', id: message.id, error: { code: error.code ?? -32603, message: error.message } });
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } });
    return;
  }
  void handleMessage(message).catch(() => {
    send({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32603, message: 'Internal error' } });
  });
});
