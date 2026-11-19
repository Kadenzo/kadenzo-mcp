# Kadenzo for AI agents

[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/kadenzo/kadenzo-mcp)

Let your AI agent schedule social media posts. [Kadenzo](https://kadenzo.app) is a hosted social media
scheduler; this repo connects it to Claude, ChatGPT, Codex, Cursor, Claude Code, Antigravity and any other
[MCP](https://modelcontextprotocol.io) client. Your agent drafts a post for each network, checks it against
that network's limits, and schedules it after you say yes, across **11 networks**: Instagram, TikTok, X,
LinkedIn, Facebook, YouTube, Pinterest, Threads, Bluesky, Telegram and Mastodon. It can also read your
analytics, best posting times and social listening.

Sign in with your Kadenzo account (OAuth), no API key needed. Needs a Kadenzo **Professional** plan or
higher ([pricing](https://kadenzo.app/pricing)).

## Install

| Agent | How |
|---|---|
| **Claude** (web and desktop) | [Kadenzo in Claude's directory](https://claude.ai/directory/kadenzo) → Connect |
| **ChatGPT** | [Kadenzo in ChatGPT's plugin directory](https://chatgpt.com/plugins/plugin_asdk_app_6abeafd359a081919cd592a1bea7943b) |
| **Codex** | Kadenzo is in the Codex plugin directory (same listing as ChatGPT): Plugins → Kadenzo, or `codex plugin add kadenzo@openai-curated-remote` |
| **Claude Code** | `/plugin install kadenzo --marketplace Kadenzo/kadenzo-mcp`, then `/mcp` to sign in |
| **Cursor** | Add the server below to `mcp.json` (or install the Kadenzo plugin), then Customize → MCPs → kadenzo → Authenticate |
| **Antigravity** | `agy plugin install https://github.com/Kadenzo/kadenzo-mcp`, then sign in from `/mcp` |
| **Gemini CLI** | `gemini extensions install https://github.com/Kadenzo/kadenzo-mcp`, then `/mcp auth kadenzo` |
| **OpenClaw** | `openclaw skills install @jors7/kadenzo-social-scheduling` (the skill; add the server below) |
| **Any MCP client** | Remote server `https://studio.kadenzo.app/api/mcp`, sign in when asked |
| **Skill only** | `npx skills add Kadenzo/kadenzo-mcp` ([skills.sh](https://skills.sh/kadenzo/kadenzo-mcp/kadenzo-social-scheduling)) |

The hosted server as JSON, for clients configured by file (Cursor's `~/.cursor/mcp.json`, for example):

```json
{
  "mcpServers": {
    "kadenzo": { "url": "https://studio.kadenzo.app/api/mcp" }
  }
}
```

Then ask: *"List my Kadenzo accounts."*

## What you can ask

- "Schedule this to LinkedIn and Threads for Tuesday 9am. Show me each version first."
- "Read the commits since Monday and write a release post for X and Bluesky." (in Cursor or Claude Code)
- "What's scheduled this week? Move Friday's post to Monday."
- "How did last week's posts do? Which network got the most engagement?"
- "When do my followers engage most? Use that time for tomorrow's post."
- "Who mentioned my brand this week?"

## How it stays safe

- **Schedule only.** Every post gets a future time and can be edited or cancelled in Kadenzo until it goes out. There is no instant-publish call.
- **Check first.** `schedule_post` with `validate_only: true` tests accounts, each network's limits and the time without creating anything.
- **Ask first.** The plugins include a skill ([`skills/kadenzo-social-scheduling`](skills/kadenzo-social-scheduling/SKILL.md)) that tells the agent to list accounts, confirm your time zone, validate, and get a clear yes before scheduling, editing or cancelling.
- **No passwords.** Your social accounts connect inside Kadenzo through each network's own login. The agent never sees a password or network token. Disconnect it any time under Settings → API keys.

## Tools

| Tool | What it does |
|------|--------------|
| `list_accounts` | List connected accounts (ids + platforms) |
| `schedule_post` | Schedule a post for a future time (+ `validate_only`, `options`, `thread`) |
| `list_posts` | List your posts, newest first (filter by status, paginate) |
| `get_post` | One post: status, per-channel outcome, options/thread |
| `update_post` | Edit a not-yet-published post |
| `cancel_post` | Cancel a scheduled post before it publishes |
| `upload_media` | Upload a local image/video file, get a URL for `media_urls` (local server only) |
| `get_account_analytics` | Recent posts + engagement metrics for an account |
| `get_post_analytics` | Per-channel metrics for a post you scheduled |
| `generate_content` | Generate post copy for a platform from a topic |
| `get_best_times` | Personalized best posting times for an account |
| `list_mentions` | Social-listening mentions (who's talking about your keywords) |
| `post_comment` | Post a comment/reply to your post (Instagram, Facebook, LinkedIn) |
| `list_keywords` | List the social-listening keywords you track |
| `add_keyword` | Track a new listening keyword (per-plan caps apply) |
| `update_keyword` | Edit a keyword, or pause/resume it with `is_active` |
| `delete_keyword` | Stop tracking a keyword (API key only) |
| `get_listening_analytics` | Mention volume, platform split, sentiment over time |
| `get_share_of_voice` | Brand vs competitor share of voice (Enterprise) |
| `list_dm_automations` | DM automation rules + funnel stats + contact usage |
| `create_dm_automation` | Create a DM automation rule (API key only) |
| `update_dm_automation` | Edit, pause or resume a rule (API key only) |
| `delete_dm_automation` | Delete a DM automation rule (API key only) |

OAuth sign-ins get 18 tools; the "API key only" ones need a key (below).

## API key instead of OAuth

Clients that send headers can use a key from Kadenzo (**Settings → API keys**):

```json
{
  "mcpServers": {
    "kadenzo": {
      "url": "https://studio.kadenzo.app/api/mcp",
      "headers": { "Authorization": "Bearer kdz_live_…" }
    }
  }
}
```

## Local server (npm)

For clients that only run local (stdio) servers, this repo is also the `kadenzo-mcp` npm package:

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

Restart the client after adding it. Requires Node 18+. `KADENZO_API_BASE` overrides the API base URL
(default `https://studio.kadenzo.app/api/v1`).

## What's in this repo

- `index.js`, `package.json`: the local npm server
- `skills/kadenzo-social-scheduling/`: the scheduling skill (Agent Skills format)
- `.cursor-plugin/`: Cursor plugin · `.antigravity-plugin/` + `mcp_config.json`: Antigravity plugin ·
  `gemini-extension.json`: Gemini CLI extension · `plugins/kadenzo/` + `.claude-plugin/`: Claude Code plugin and marketplace
- `server.json`: [MCP Registry](https://registry.modelcontextprotocol.io) entry (`io.github.jors7/kadenzo-mcp`)

Docs and REST API: <https://studio.kadenzo.app/developers> · Guides: [schedule posts with Claude](https://kadenzo.app/blog/schedule-social-media-posts-with-claude) · MIT license
