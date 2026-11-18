# Kadenzo MCP server

Connect any MCP-capable AI agent (**Claude, ChatGPT, Claude Code, Cursor, Codex**) to
[Kadenzo](https://kadenzo.app) and let it schedule, manage, and analyze social posts
across **11 networks** (Instagram, TikTok, X, LinkedIn, YouTube, Facebook, Pinterest,
Threads, Bluesky, Mastodon, Telegram). It wraps the Kadenzo Studio public API as
[Model Context Protocol](https://modelcontextprotocol.io) tools, so your agent doesn't
just *draft* content — it can **ship** it.

## Tools

| Tool | What it does |
|------|--------------|
| `list_accounts` | List connected accounts (ids + platforms) |
| `schedule_post` | Schedule a post for a future time (+ `validate_only`, `options`, `thread`) |
| `list_posts` | List your posts, newest first (filter by status, paginate) |
| `get_post` | One post: status, per-channel outcome, options/thread |
| `update_post` | Edit a not-yet-published post |
| `cancel_post` | Cancel a scheduled post before it publishes |
| `upload_media` | Upload a local image/video file, get a URL for `media_urls` |
| `get_account_analytics` | Recent posts + engagement metrics for an account |
| `get_post_analytics` | Per-channel metrics for a post you scheduled |
| `generate_content` | Generate post copy for a platform from a topic ("generate then schedule") |
| `get_best_times` | Personalized best posting times for an account (Professional+) |
| `list_mentions` | Social-listening mentions (who's talking about your keywords) |
| `post_comment` | Post a comment/reply to your post (instagram/facebook/linkedin) |
| `list_keywords` | List the social-listening keywords you track |
| `add_keyword` | Track a new listening keyword (per-plan caps apply) |
| `update_keyword` | Edit a keyword, or pause/resume it with `is_active` |
| `delete_keyword` | Stop tracking a keyword |
| `get_listening_analytics` | Mention volume, platform split, sentiment over time |
| `get_share_of_voice` | Brand vs competitor Share of Voice report (Enterprise) |
| `list_dm_automations` | DM automation rules + funnel stats + contact usage |
| `create_dm_automation` | Create a DM automation rule (comment→DM, keyword DM, DM links, …) |
| `update_dm_automation` | Edit a rule, or pause/resume it with `active` |
| `delete_dm_automation` | Delete a DM automation rule |

## Hosted server (recommended, no install)

Kadenzo also runs this server for you at **`https://studio.kadenzo.app/api/mcp`**. Apps that
support remote MCP servers connect by signing in with Kadenzo, no API key to copy:

- **Claude** (web and desktop): [Kadenzo in Claude's connector directory](https://claude.ai/directory/kadenzo) → Connect.
- **ChatGPT**: Settings → Security and login → Developer mode, then Plugins → + → MCP app with the URL and OAuth (Developer mode is still rolling out on some accounts).
- **Claude Code**: install the Kadenzo plugin (the hosted server plus a scheduling skill), then `/mcp` to sign in:
  ```
  /plugin install kadenzo --marketplace Kadenzo/kadenzo-mcp
  ```
  Or add only the server: `claude mcp add --transport http kadenzo https://studio.kadenzo.app/api/mcp`.
  If you already connected Kadenzo on claude.ai, Claude Code has the tools already; the plugin adds the skill.
- **Antigravity**: `agy plugin install https://github.com/Kadenzo/kadenzo-mcp` (plugin manifest in
  `.antigravity-plugin/`, server in `mcp_config.json`, plus the scheduling skill), then sign in to the
  `kadenzo` server and paste the code from the Kadenzo page back into Antigravity.
- **Gemini CLI**: `gemini extensions install https://github.com/Kadenzo/kadenzo-mcp`, then start `gemini`
  and sign in when the Kadenzo server asks (`/mcp auth kadenzo`). The extension also loads the scheduling skill.
- **Cursor**: install the Kadenzo plugin (this repo is one: `.cursor-plugin/plugin.json`, `mcp.json` and a
  scheduling skill in `skills/`), then Customize → MCPs → kadenzo → Authenticate. Or add the URL yourself
  under Customize → MCPs → New MCP Server.

Clients that send headers can use an API key instead: `"url": "https://studio.kadenzo.app/api/mcp"` with
`"headers": { "Authorization": "Bearer kdz_live_…" }`. The hosted server has the same tools except
`upload_media` (pass public `media_urls` instead). Connections need the Professional plan or higher.

## Local setup (this package)

Use this npm package when your client only runs local (stdio) servers.

1. Generate an API key in Kadenzo: **Settings → API keys** (`studio.kadenzo.app/dashboard/settings?section=api`). The API is available on paid plans.
2. Add the server to your MCP client. **Claude Desktop** (`claude_desktop_config.json`) / **Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "kadenzo": {
      "command": "npx",
      "args": ["-y", "kadenzo-mcp"],
      "env": { "KADENZO_API_KEY": "kdz_live_xxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

3. Restart the client. Ask your agent things like *"list my connected accounts,"* *"schedule this to X and Bluesky tomorrow at 9am,"* or *"how did my last Instagram posts perform?"*

## Notes

- Posts are **schedule-only** — provide a future `scheduled_for`; they publish automatically.
- `KADENZO_API_BASE` overrides the API base URL (default `https://studio.kadenzo.app/api/v1`).
- Requires Node 18+ (uses the built-in `fetch`/`FormData`).
- Learn more / full API reference: <https://studio.kadenzo.app/developers> · <https://kadenzo.app>
