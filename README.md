# Meta Ads MCP

One Node.js MCP server for the Meta Marketing API (Graph API). It has no npm dependencies.

It manages Instagram and Facebook campaigns, ad sets, ads, and creatives for one ad account. It also reads insights and Instagram media.

## Tools

| Tool | Access | Function |
| --- | --- | --- |
| `auth_status` | Read | Shows the token permissions, the token expiry, and the ad account |
| `list` | Read | Lists campaigns, ad sets, ads, creatives, audiences, pixels, and media |
| `get` | Read | Gets one object by ID |
| `insights` | Read | Gets performance data for the account, a campaign, an ad set, or an ad |
| `targeting_search` | Read | Finds interests, locations, locales, and categories |
| `create` | Write | Makes a campaign, ad set, creative, or ad |
| `update` | Write | Changes fields, for example budget, targeting, or name |
| `set_status` | Write | Sets ACTIVE, PAUSED, or ARCHIVED |
| `copy` | Write | Copies a campaign, ad set, or ad |
| `delete` | Write | Deletes a campaign, ad set, ad, or creative |

## Safety

A write can spend money. These rules apply to each write:

- The call needs an exact change summary and `user_confirmed: true`.
- `create` and `copy` always make PAUSED objects.
- `update` refuses a status change. Activation is a separate `set_status` call.
- `update`, `set_status`, `copy`, and `delete` first make sure that the object belongs to the configured ad account.

## Requirements

- Node.js 24 or later.
- The ID of a Meta ad account.
- A Meta access token for that account. The read tools need `ads_read`. The write tools need `ads_management`. Instagram media and stories also need Instagram permissions.

`auth_status` shows the granted permissions and the token expiry.

## Install

**Claude Code.** Load the directory for one session:

```sh
claude --plugin-dir /path/to/meta-ads-mcp
```

For a permanent installation, add the directory to a plugin marketplace. The plugin includes the `meta-ads` skill, which has campaign recipes.

**Other MCP clients.** Start the server on stdio:

```json
{
  "mcpServers": {
    "meta_ads": {
      "command": "node",
      "args": ["/absolute/path/to/meta-ads-mcp/scripts/server.mjs"]
    }
  }
}
```

## Configuration

The source contains no account data. Put the settings in an env file with mode `600`. See `meta-ads.env.example`.

The env file is the first of these that is set:

1. `META_ADS_ENV_FILE`
2. `$XDG_CONFIG_HOME/meta-ads/meta-ads.env`
3. `~/.config/meta-ads/meta-ads.env`

| Variable | Content |
| --- | --- |
| `META_ADS_ACCOUNT_ID` | The ad account ID, with or without the `act_` prefix |
| `META_ADS_ACCESS_TOKEN` | The access token |
| `META_ADS_API_VERSION` | Optional. The Graph API version. The default is `v23.0`. |

A variable in the environment of the server process overrides the value in the file.

The server reads the file on each call, so a new token needs no restart. The server sends the token in the `Authorization` header.

## Backup

```sh
node scripts/backup.mjs <output-directory>
```

This command makes a read-only export of the ad account as JSON files: campaigns, ad sets, ads, creatives, audiences, pixels, and insights. The output contains your account data. Do not put it in a public repository.

## Tests

```sh
npm test                      # protocol and write guards; no network, no credentials
node scripts/test.mjs --live  # read-only requests to Meta
```

## License

MIT. See `LICENSE`.
