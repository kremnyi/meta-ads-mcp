import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const defaultVersion = "v23.0";

// META_ADS_ENV_FILE, else $XDG_CONFIG_HOME/meta-ads/meta-ads.env, else ~/.config/meta-ads/meta-ads.env.
function envFile() {
  return (
    process.env.META_ADS_ENV_FILE ||
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "meta-ads", "meta-ads.env")
  );
}

const createEdges = { campaign: "campaigns", adset: "adsets", adcreative: "adcreatives", ad: "ads" };
const pausedOnCreate = ["campaign", "adset", "ad"];
const listEdges = [
  "campaigns", "adsets", "ads", "adcreatives", "adspixels", "customconversions", "customaudiences",
  "saved_audiences", "instagram_accounts", "advideos", "adimages", "activities", "copies", "media", "stories",
];
const searchTypes = ["adinterest", "adgeolocation", "adlocale", "adTargetingCategory", "adinterestsuggestion"];
const statuses = ["ACTIVE", "PAUSED", "ARCHIVED"];

const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const destructiveAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

const confirmationProperties = {
  change_summary: {
    type: "string",
    minLength: 8,
    description: "Concise exact change the user approved in the current request, with budget and status.",
  },
  user_confirmed: {
    type: "boolean",
    const: true,
    description: "Must be true only after explicit action-time user confirmation.",
  },
};
const confirmed = ["change_summary", "user_confirmed"];
const idProperty = { type: "string", description: "Numeric Meta object ID." };
const paramsProperty = {
  type: "object",
  description: "Marketing API fields for the object. Nested objects and arrays are JSON-encoded by the server. Budgets are in the minor unit of the account currency.",
};
const pagingProperties = {
  fields: { type: "string", description: "Comma-separated Graph API fields." },
  limit: { type: "integer", minimum: 1, maximum: 500 },
  after: { type: "string", description: "Paging cursor from a previous result." },
};

export const tools = [
  {
    name: "auth_status",
    description: "Check the Meta access token, its permissions and expiry, and the configured ad account.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: readAnnotations,
  },
  {
    name: "list",
    description: "List one edge of the ad account or of another object. Examples: campaigns of the account, ads of a campaign, media or stories of an Instagram account.",
    inputSchema: {
      type: "object",
      required: ["edge"],
      additionalProperties: false,
      properties: {
        edge: { enum: listEdges },
        parent_id: { type: "string", description: "Numeric object ID. Default: the configured ad account." },
        effective_status: { type: "array", items: { type: "string" }, description: "Example: [\"ACTIVE\",\"PAUSED\"]." },
        filtering: { type: "array", items: { type: "object" }, description: "Graph API filtering objects." },
        ...pagingProperties,
      },
    },
    annotations: readAnnotations,
  },
  {
    name: "get",
    description: "Get one campaign, ad set, ad, creative, or other object by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: { id: idProperty, fields: pagingProperties.fields },
    },
    annotations: readAnnotations,
  },
  {
    name: "insights",
    description: "Get performance insights for the ad account, a campaign, an ad set, or an ad.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        object_id: { type: "string", description: "Numeric object ID. Default: the configured ad account." },
        level: { enum: ["account", "campaign", "adset", "ad"] },
        date_preset: { type: "string", description: "Example: last_7d, last_30d, maximum." },
        time_range: {
          type: "object",
          required: ["since", "until"],
          additionalProperties: false,
          properties: { since: { type: "string" }, until: { type: "string" } },
        },
        time_increment: { type: "string", description: "1 for daily rows, monthly, or all_days." },
        breakdowns: { type: "string", description: "Example: publisher_platform,platform_position." },
        filtering: { type: "array", items: { type: "object" } },
        ...pagingProperties,
      },
    },
    annotations: readAnnotations,
  },
  {
    name: "targeting_search",
    description: "Search targeting options: interests, locations, locales, or categories.",
    inputSchema: {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: { enum: searchTypes },
        q: { type: "string" },
        extra: { type: "object", description: "More search parameters, for example location_types or class." },
        limit: pagingProperties.limit,
      },
    },
    annotations: readAnnotations,
  },
  {
    name: "create",
    description: "Create a campaign, ad set, creative, or ad in the configured ad account. Campaigns, ad sets, and ads are always created PAUSED. Requires explicit user confirmation.",
    inputSchema: {
      type: "object",
      required: ["object_type", "params", ...confirmed],
      additionalProperties: false,
      properties: { object_type: { enum: Object.keys(createEdges) }, params: paramsProperty, ...confirmationProperties },
    },
    annotations: writeAnnotations,
  },
  {
    name: "update",
    description: "Update fields of a campaign, ad set, or ad, for example budget, targeting, or name. Does not change status; use set_status. Requires explicit user confirmation.",
    inputSchema: {
      type: "object",
      required: ["id", "params", ...confirmed],
      additionalProperties: false,
      properties: { id: idProperty, params: paramsProperty, ...confirmationProperties },
    },
    annotations: writeAnnotations,
  },
  {
    name: "set_status",
    description: "Set a campaign, ad set, or ad to ACTIVE, PAUSED, or ARCHIVED. ACTIVE starts ad spend and needs its own explicit confirmation after the user reviewed the object.",
    inputSchema: {
      type: "object",
      required: ["id", "status", ...confirmed],
      additionalProperties: false,
      properties: { id: idProperty, status: { enum: statuses }, ...confirmationProperties },
    },
    annotations: destructiveAnnotations,
  },
  {
    name: "copy",
    description: "Copy a campaign, ad set, or ad. The copy is always PAUSED. Requires explicit user confirmation.",
    inputSchema: {
      type: "object",
      required: ["id", ...confirmed],
      additionalProperties: false,
      properties: {
        id: idProperty,
        params: { type: "object", description: "Copy parameters, for example campaign_id, adset_id, deep_copy, rename_options." },
        ...confirmationProperties,
      },
    },
    annotations: writeAnnotations,
  },
  {
    name: "delete",
    description: "Delete a campaign, ad set, ad, or creative. Requires explicit confirmation of this exact deletion.",
    inputSchema: {
      type: "object",
      required: ["id", ...confirmed],
      additionalProperties: false,
      properties: { id: idProperty, ...confirmationProperties },
    },
    annotations: destructiveAnnotations,
  },
];

function output(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
}

function loadConfig() {
  const file = envFile();
  const values = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  // A variable in the process environment overrides the value in the file.
  const setting = (name) => process.env[name]?.trim() || values[name];
  const token = setting("META_ADS_ACCESS_TOKEN");
  const account = String(setting("META_ADS_ACCOUNT_ID") ?? "").replace(/^act_/, "");
  if (!token || !/^\d+$/.test(account)) {
    throw new Error(`Meta credentials are missing. Set META_ADS_ACCOUNT_ID and META_ADS_ACCESS_TOKEN in ${file} or in the environment.`);
  }
  return { token, account, accountId: `act_${account}`, version: setting("META_ADS_API_VERSION") || defaultVersion };
}

function encode(params = {}) {
  const entries = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    entries.push([key, typeof value === "object" ? JSON.stringify(value) : String(value)]);
  }
  return entries;
}

async function graph(config, method, objectPath, params) {
  const url = new URL(`https://graph.facebook.com/${config.version}/${objectPath}`);
  const init = { method, headers: { Authorization: `Bearer ${config.token}` } };
  if (method === "POST") init.body = new URLSearchParams(encode(params));
  else for (const [key, value] of encode(params)) url.searchParams.set(key, value);

  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const error = body.error ?? {};
    throw new Error(JSON.stringify({
      message: error.message ?? `HTTP ${response.status}`,
      user_title: error.error_user_title,
      user_message: error.error_user_msg,
      type: error.type,
      code: error.code,
      subcode: error.error_subcode,
      fbtrace_id: error.fbtrace_id,
    }));
  }
  return body;
}

function objectId(value, field = "id") {
  const id = String(value ?? "");
  if (!/^\d+$/.test(id)) throw new Error(`${field} must be a numeric Meta object ID`);
  return id;
}

function requireConfirmation(args) {
  if (args.user_confirmed !== true || String(args.change_summary ?? "").trim().length < 8) {
    throw new Error("This Meta Ads change requires explicit action-time user confirmation and a change summary.");
  }
}

function requireParams(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new Error("params must be a non-empty object");
  }
  return value;
}

// Writes must not touch an object that belongs to a different ad account.
async function assertOwned(config, id) {
  const object = await graph(config, "GET", id, { fields: "account_id" });
  if (String(object.account_id) !== config.account) {
    throw new Error(`Object ${id} does not belong to the configured ad account ${config.accountId}`);
  }
}

async function attempt(promise) {
  try {
    return await promise;
  } catch (error) {
    return { error: error.message };
  }
}

export async function callTool(name, args = {}) {
  if (name === "auth_status") {
    const config = loadConfig();
    const [user, permissions, token, account] = await Promise.all([
      attempt(graph(config, "GET", "me", { fields: "id,name" })),
      attempt(graph(config, "GET", "me/permissions")),
      attempt(graph(config, "GET", "debug_token", { input_token: config.token })),
      attempt(graph(config, "GET", config.accountId, {
        fields: "id,name,account_status,disable_reason,currency,timezone_name,amount_spent,spend_cap,business",
      })),
    ]);
    const expiresAt = token.data?.expires_at;
    return output({
      connected: !user.error && !account.error,
      api_version: config.version,
      user,
      granted_permissions: permissions.data?.filter((item) => item.status === "granted").map((item) => item.permission) ?? permissions,
      token: token.error ? token : {
        type: token.data?.type,
        valid: token.data?.is_valid,
        expires: expiresAt ? new Date(expiresAt * 1000).toISOString() : "never",
      },
      account,
    });
  }

  if (name === "list") {
    if (!listEdges.includes(args.edge)) throw new Error("Unsupported edge");
    const config = loadConfig();
    const parent = args.parent_id ? objectId(args.parent_id, "parent_id") : config.accountId;
    return output(await graph(config, "GET", `${parent}/${args.edge}`, {
      fields: args.fields,
      effective_status: args.effective_status,
      filtering: args.filtering,
      limit: args.limit ?? 50,
      after: args.after,
    }));
  }

  if (name === "get") {
    const id = objectId(args.id);
    return output(await graph(loadConfig(), "GET", id, { fields: args.fields }));
  }

  if (name === "insights") {
    const config = loadConfig();
    const parent = args.object_id ? objectId(args.object_id, "object_id") : config.accountId;
    return output(await graph(config, "GET", `${parent}/insights`, {
      fields: args.fields ?? "campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,cpm,cpc,ctr,actions",
      level: args.level,
      date_preset: args.time_range ? undefined : args.date_preset ?? "last_7d",
      time_range: args.time_range,
      time_increment: args.time_increment,
      breakdowns: args.breakdowns,
      filtering: args.filtering,
      limit: args.limit ?? 100,
      after: args.after,
    }));
  }

  if (name === "targeting_search") {
    if (!searchTypes.includes(args.type)) throw new Error("Unsupported search type");
    return output(await graph(loadConfig(), "GET", "search", {
      ...args.extra, type: args.type, q: args.q, limit: args.limit ?? 25,
    }));
  }

  if (!["create", "update", "set_status", "copy", "delete"].includes(name)) throw new Error(`Unknown tool: ${name}`);
  requireConfirmation(args);

  if (name === "create") {
    const edge = createEdges[args.object_type];
    if (!edge) throw new Error("Unsupported object_type");
    const params = { ...requireParams(args.params) };
    if (pausedOnCreate.includes(args.object_type)) {
      if (params.status && params.status !== "PAUSED") {
        throw new Error("New objects are created PAUSED. Use set_status to activate after the user reviewed the object.");
      }
      params.status = "PAUSED";
    }
    const config = loadConfig();
    return output(await graph(config, "POST", `${config.accountId}/${edge}`, params));
  }

  const id = objectId(args.id);

  if (name === "update") {
    const params = requireParams(args.params);
    if ("status" in params) throw new Error("update does not change status. Use set_status.");
    const config = loadConfig();
    await assertOwned(config, id);
    return output(await graph(config, "POST", id, params));
  }

  if (name === "set_status") {
    if (!statuses.includes(args.status)) throw new Error("Unsupported status");
    const config = loadConfig();
    await assertOwned(config, id);
    return output(await graph(config, "POST", id, { status: args.status }));
  }

  if (name === "copy") {
    const config = loadConfig();
    await assertOwned(config, id);
    return output(await graph(config, "POST", `${id}/copies`, { ...args.params, status_option: "PAUSED" }));
  }

  const config = loadConfig();
  await assertOwned(config, id);
  return output(await graph(config, "DELETE", id));
}
