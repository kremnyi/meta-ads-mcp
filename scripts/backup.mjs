import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { callTool } from './tools.mjs';

// Read-only export of the configured ad account. Usage: node scripts/backup.mjs <output-directory>
const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/backup.mjs <output-directory>');
mkdirSync(out, { recursive: true });

const summary = { exported_at: new Date().toISOString(), counts: {}, errors: [] };
const call = async (name, args) => (await callTool(name, args)).structuredContent;

async function pages(name, args) {
  const rows = [];
  let after;
  do {
    const page = await call(name, { ...args, after });
    rows.push(...(page.data ?? []));
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
  } while (after);
  return rows;
}

async function save(file, label, load) {
  try {
    const data = await load();
    writeFileSync(path.join(out, file), `${JSON.stringify(data, null, 2)}\n`);
    summary.counts[label] = Array.isArray(data) ? data.length : 1;
  } catch (error) {
    summary.errors.push({ label, error: error.message });
  }
}

// The default list omits archived and deleted objects, so each status group is read separately and merged.
async function allStatuses(edge, fields, limit) {
  const byId = new Map();
  for (const effective_status of [undefined, ['ARCHIVED'], ['DELETED']]) {
    try {
      for (const row of await pages('list', { edge, fields, limit, effective_status })) byId.set(row.id, row);
    } catch (error) {
      summary.errors.push({ label: `${edge} ${effective_status ?? 'default'}`, error: error.message });
    }
  }
  return [...byId.values()];
}

const metrics = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,cpm,cpc,ctr,actions,cost_per_action_type,video_thruplay_watched_actions,date_start,date_stop';
const insights = (extra) => () => pages('insights', { date_preset: 'maximum', limit: 200, ...extra });

await save('account.json', 'account', () => call('auth_status', {}).then((status) => ({ account: status.account, api_version: status.api_version })));
await save('campaigns.json', 'campaigns', () => allStatuses('campaigns', 'id,name,status,effective_status,objective,buying_type,special_ad_categories,bid_strategy,daily_budget,lifetime_budget,spend_cap,start_time,stop_time,created_time,updated_time', 100));
await save('adsets.json', 'adsets', () => allStatuses('adsets', 'id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,bid_amount,daily_budget,lifetime_budget,start_time,end_time,destination_type,promoted_object,targeting,attribution_spec,dsa_payor,dsa_beneficiary,created_time,updated_time', 50));
await save('ads.json', 'ads', () => allStatuses('ads', 'id,name,campaign_id,adset_id,status,effective_status,creative{id,name},created_time,updated_time', 100));
await save('adcreatives.json', 'adcreatives', () => pages('list', { edge: 'adcreatives', limit: 50, fields: 'id,name,status,object_type,object_story_spec,object_story_id,effective_object_story_id,source_instagram_media_id,instagram_user_id,instagram_permalink_url,call_to_action_type,url_tags,asset_feed_spec,title,body,image_url,image_hash,video_id,thumbnail_url,link_url' }));
await save('adimages.json', 'adimages', () => pages('list', { edge: 'adimages', limit: 100, fields: 'id,hash,name,url,permalink_url,width,height,created_time' }));
await save('advideos.json', 'advideos', () => pages('list', { edge: 'advideos', limit: 50, fields: 'id,title,description,source,permalink_url,length,created_time' }));
await save('pixels.json', 'pixels', () => pages('list', { edge: 'adspixels', fields: 'id,name,creation_time,last_fired_time,is_unavailable' }));
await save('customconversions.json', 'customconversions', () => pages('list', { edge: 'customconversions', fields: 'id,name,pixel{id,name},custom_event_type,event_source_type,rule,is_archived,creation_time,last_fired_time' }));
await save('customaudiences.json', 'customaudiences', () => pages('list', { edge: 'customaudiences', fields: 'id,name,subtype,description,rule,approximate_count_lower_bound,approximate_count_upper_bound,time_created' }));
await save('saved_audiences.json', 'saved_audiences', () => pages('list', { edge: 'saved_audiences', fields: 'id,name,targeting,time_created' }));
await save('instagram_accounts.json', 'instagram_accounts', () => pages('list', { edge: 'instagram_accounts', fields: 'id,username' }));
await save('activities.json', 'activities', () => pages('list', { edge: 'activities', limit: 200, fields: 'event_time,event_type,translated_event_type,object_id,object_name,object_type,actor_name,extra_data' }));
await save('insights_campaign.json', 'insights_campaign', insights({ level: 'campaign', fields: `campaign_id,campaign_name,${metrics}` }));
await save('insights_adset.json', 'insights_adset', insights({ level: 'adset', fields: `campaign_id,adset_id,adset_name,${metrics}` }));
await save('insights_ad.json', 'insights_ad', insights({ level: 'ad', fields: `campaign_id,adset_id,ad_id,ad_name,${metrics}` }));
await save('insights_ad_by_placement.json', 'insights_ad_by_placement', insights({ level: 'ad', breakdowns: 'publisher_platform,platform_position', fields: `ad_id,ad_name,${metrics}` }));
await save('insights_account_monthly.json', 'insights_account_monthly', insights({ level: 'account', time_increment: 'monthly', fields: metrics }));

writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
