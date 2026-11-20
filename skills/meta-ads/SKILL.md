---
name: meta-ads
description: Use when the user plans, creates, changes, or reports on Meta (Instagram or Facebook) ad campaigns, for example boosting reels, showing stories, or reading ad results. Gives the campaign recipes and the confirmation rules for the meta_ads MCP tools.
---

# Meta Ads

Use the `meta_ads` MCP tools. They call the Meta Marketing API for one ad account.

## Rules

- Start each session with `auth_status`. `account_status` 1 is active. Other values mean that ads cannot run; tell the user before any other work.
- Every write can spend money. Show the exact change first: object, budget in account currency, targeting, placements, status. Then get the user's confirmation in the current request.
- New and copied objects are always PAUSED. `set_status` to ACTIVE needs a second confirmation after the user reviewed the paused object.
- Budgets are in the minor currency unit. `daily_budget: 500` is 5.00 in a USD account.
- Read the current object with `get` before `update`. Read an existing ad set before you build a similar one; copy its `promoted_object`, DSA fields, and targeting shape instead of guessing IDs.
- After a write, read the object again and report `effective_status` and any `issues_info`.
- Report results with `insights`. Missing rows mean no data, not zero.

## Structure

Campaign (objective) -> ad set (budget, targeting, placements, optimization) -> ad (creative).

Create in that order with `create`. Reuse an existing creative when the same post is promoted again.

## Recipe: boost reels for Instagram profile visits

1. Campaign: `objective: OUTCOME_TRAFFIC`, `buying_type: AUCTION`, `special_ad_categories: []`, `is_adset_budget_sharing_enabled: false`.
2. Ad set: `billing_event: IMPRESSIONS`, `optimization_goal: VISIT_INSTAGRAM_PROFILE`, `destination_type: INSTAGRAM_PROFILE`, `bid_strategy: LOWEST_COST_WITHOUT_CAP`, `promoted_object: {page_id, smart_pse_enabled: false}`, `daily_budget`, `targeting`.
3. Creative from an existing reel: `source_instagram_media_id`, `instagram_user_id`, `call_to_action_type: VIEW_INSTAGRAM_PROFILE`. Get the IDs with `list` edge `instagram_accounts`, then `list` edge `media` with `parent_id` set to the Instagram account ID. After creation, `get` the creative and check that `instagram_permalink_url` is the intended reel.
4. Ad: `adset_id`, `creative: {creative_id}`.

## Recipe: stories that send leads to the website

1. Campaign: `objective: OUTCOME_LEADS`, other fields as above.
2. Ad set: `optimization_goal: OFFSITE_CONVERSIONS`, `destination_type: WEBSITE`, `promoted_object: {pixel_id, custom_event_type: LEAD}`. Find the pixel with `list` edge `adspixels`.
3. Stories only: in `targeting` set `publisher_platforms: ["instagram"]` and `instagram_positions: ["story"]`. Add `"reels"` to the positions for reels placement.
4. Creative: `object_story_spec` with the image or video, link, and `call_to_action`.

## Targeting

- Minimum shape: `geo_locations` (`countries` or `cities` with `key` and `radius`), `age_min`, `age_max`.
- Find city keys, interests, and locales with `targeting_search` (`adgeolocation`, `adinterest`, `adlocale`).
- Ad sets that target the EU need `dsa_payor` and `dsa_beneficiary`. Copy the values from an existing ad set.
- Optional limits: `device_platforms: ["mobile"]`, `user_os: ["iOS"]`, `locales`.

## Reporting

`insights` with `level: ad` or `campaign`, a `date_preset` or `time_range`, and `breakdowns: publisher_platform,platform_position` to separate reels from stories. Profile visits and follows are in `actions`.
