# Kadenzo plugin for Claude Code

Schedule, review and analyze social media posts on 11 networks from Claude Code, through Kadenzo's
hosted MCP server (`https://studio.kadenzo.app/api/mcp`). Includes a scheduling skill that has Claude
check your accounts and time zone, validate first and confirm before anything is scheduled.

```
/plugin install kadenzo --marketplace Kadenzo/kadenzo-mcp
```

Then run `/mcp`, pick `plugin:kadenzo:kadenzo` and sign in with your Kadenzo account. Needs a
Professional or Enterprise plan. Docs: https://studio.kadenzo.app/developers

The skill here is a copy of `skills/kadenzo-social-scheduling` at the repo root (used by the Cursor
plugin). Edit both together.
