#!/usr/bin/env node
/**
 * Kadenzo MCP server — exposes the Kadenzo Studio public API (studio.kadenzo.app/api/v1)
 * as Model Context Protocol tools, so any MCP-capable agent (Claude Desktop, Cursor,
 * ChatGPT, …) can schedule, manage, and analyze social posts across 11 networks.
 *
 * Auth: set KADENZO_API_KEY (generate at studio.kadenzo.app/dashboard/settings?section=api).
 * Transport: stdio (the standard for locally-run MCP servers).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const API_KEY = process.env.KADENZO_API_KEY
const BASE = (process.env.KADENZO_API_BASE || 'https://studio.kadenzo.app/api/v1').replace(/\/$/, '')

// Note: we do NOT exit when KADENZO_API_KEY is missing — the server still starts
// and can be introspected (tools/list works without a key). A key is only needed
// when a tool is actually called; missing-key errors surface per-call instead.
if (!API_KEY) {
  console.error('KADENZO_API_KEY is not set — the server will start and list tools, but calls will fail until it is set. Generate a key at https://studio.kadenzo.app/dashboard/settings?section=api')
}

async function api(method, path, { body, query } = {}) {
  if (!API_KEY) throw new Error('KADENZO_API_KEY is not set. Generate one at studio.kadenzo.app/dashboard/settings?section=api and set it in your MCP client config.')
  const url = new URL(BASE + path)
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v))
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) {
    const msg = data && typeof data === 'object' ? data.error || JSON.stringify(data) : String(data)
    throw new Error(`${res.status} ${msg}`)
  }
  return data
}

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] })
const fail = (e) => ({ content: [{ type: 'text', text: `Error: ${e?.message || e}` }], isError: true })

// Keep in sync with package.json + server.json on every release.
const server = new McpServer({ name: 'kadenzo', version: '1.4.0' })

server.tool(
  'list_accounts',
  'List the social accounts connected to this Kadenzo workspace — returns each account id, platform, and username. Use the ids as account_ids when scheduling.',
  {},
  async () => { try { return ok(await api('GET', '/accounts')) } catch (e) { return fail(e) } },
)

server.tool(
  'schedule_post',
  'Schedule a social post to one or more connected accounts for a FUTURE time (it publishes automatically). Set validate_only=true to check accounts/limits/timing without scheduling.',
  {
    content: z.string().optional().describe('Post text. Optional only if media_urls is provided.'),
    account_ids: z.array(z.string()).describe('Account ids from list_accounts (at least one).'),
    scheduled_for: z.string().describe('ISO 8601 future datetime, e.g. "2026-07-02T09:00:00Z".'),
    media_urls: z.array(z.string()).optional().describe('Public image/video URLs, or URLs returned by upload_media.'),
    platform_content: z.record(z.string()).optional().describe('Per-platform text overrides, e.g. {"twitter":"shorter text"}.'),
    options: z.record(z.any()).optional().describe('Per-platform format options, e.g. {"instagram":{"as_reel":true,"first_comment":"#tags"},"tiktok":{"privacy_level":"PUBLIC_TO_EVERYONE"}}.'),
    thread: z.record(z.array(z.string())).optional().describe('Multi-post threads, e.g. {"x":["1/…","2/…"],"bluesky":["…"]}.'),
    validate_only: z.boolean().optional().describe('If true, validate only (dry run) and do not schedule.'),
  },
  async ({ validate_only, ...rest }) => {
    try {
      const body = { ...rest }
      if (validate_only) body.dry_run = true
      return ok(await api('POST', '/posts', { body }))
    } catch (e) { return fail(e) }
  },
)

server.tool(
  'list_posts',
  'List your posts, newest first. Optionally filter by status (comma-separated, e.g. "pending,posted") and paginate with limit (1-100) and offset.',
  {
    status: z.string().optional().describe('Comma-separated statuses, or omit for all.'),
    limit: z.number().optional(),
    offset: z.number().optional(),
  },
  async (a) => { try { return ok(await api('GET', '/posts', { query: a })) } catch (e) { return fail(e) } },
)

server.tool(
  'get_post',
  'Get one post: roll-up status, per-channel outcome, and any options/thread that were set on it.',
  { id: z.string().describe('The post id.') },
  async ({ id }) => { try { return ok(await api('GET', `/posts/${id}`)) } catch (e) { return fail(e) } },
)

server.tool(
  'update_post',
  'Edit a post that has not published yet — change content, accounts, time, media, options, or thread.',
  {
    id: z.string(),
    content: z.string().optional(),
    account_ids: z.array(z.string()).optional(),
    scheduled_for: z.string().optional(),
    media_urls: z.array(z.string()).optional(),
    platform_content: z.record(z.string()).optional(),
    options: z.record(z.any()).optional(),
    thread: z.record(z.array(z.string())).optional(),
  },
  async ({ id, ...body }) => { try { return ok(await api('PATCH', `/posts/${id}`, { body })) } catch (e) { return fail(e) } },
)

server.tool(
  'cancel_post',
  'Cancel a scheduled post before it publishes. Already-published posts cannot be cancelled.',
  { id: z.string() },
  async ({ id }) => { try { return ok(await api('DELETE', `/posts/${id}`)) } catch (e) { return fail(e) } },
)

server.tool(
  'upload_media',
  'Upload a local image or video file and get a hosted URL to use in media_urls when scheduling.',
  { path: z.string().describe('Absolute path to a local image/video file.') },
  async ({ path }) => {
    try {
      if (!API_KEY) throw new Error('KADENZO_API_KEY is not set. Generate one at studio.kadenzo.app/dashboard/settings?section=api')
      const buf = await readFile(path)
      const fd = new FormData()
      fd.append('file', new Blob([buf]), basename(path))
      const res = await fetch(`${BASE}/media`, { method: 'POST', headers: { Authorization: `Bearer ${API_KEY}` }, body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${res.status} ${data.error || JSON.stringify(data)}`)
      return ok(data)
    } catch (e) { return fail(e) }
  },
)

server.tool(
  'get_account_analytics',
  'Recent posts and their engagement metrics for one connected account (likes, comments, views, etc.). The reliable analytics surface.',
  { account_id: z.string(), limit: z.number().optional().describe('1-100, default 25.') },
  async ({ account_id, limit }) => { try { return ok(await api('GET', `/accounts/${account_id}/analytics`, { query: { limit } })) } catch (e) { return fail(e) } },
)

server.tool(
  'get_post_analytics',
  'Per-channel engagement metrics for a specific post you scheduled (best-effort; use get_account_analytics for the full picture).',
  { id: z.string() },
  async ({ id }) => { try { return ok(await api('GET', `/posts/${id}/analytics`)) } catch (e) { return fail(e) } },
)

server.tool(
  'generate_content',
  'Generate post copy for a platform from a topic — great for a "generate then schedule" flow. Returns a caption/post/description you can feed into schedule_post. Platform must be one of: instagram, tiktok, snapchat, facebook, youtube.',
  {
    topic: z.string().describe('What the post is about (2-500 characters).'),
    platform: z.enum(['instagram', 'tiktok', 'snapchat', 'facebook', 'youtube']),
    goal: z.enum(['story', 'educate', 'promote']).optional().describe('Angle for the copy. Defaults to "story".'),
  },
  async (a) => { try { return ok(await api('POST', '/generate', { body: a })) } catch (e) { return fail(e) } },
)

server.tool(
  'get_best_times',
  'Personalized best posting times for one connected account, computed from its own engagement history. Requires the Professional plan or higher. Hours are UTC; shift to the poster’s timezone. Use it to pick scheduled_for.',
  { account_id: z.string() },
  async ({ account_id }) => { try { return ok(await api('GET', `/accounts/${account_id}/best-times`)) } catch (e) { return fail(e) } },
)

server.tool(
  'list_mentions',
  'Your social-listening mentions — who is talking about the keywords you track (reddit/bluesky/youtube/hackernews/…), newest first. Filter by platform, since (ISO), or unread.',
  {
    platform: z.string().optional(),
    since: z.string().optional().describe('ISO datetime; only mentions published after this.'),
    unread: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  },
  async (a) => {
    try {
      const query = { platform: a.platform, since: a.since, limit: a.limit, offset: a.offset }
      if (a.unread) query.unread = 'true'
      return ok(await api('GET', '/mentions', { query }))
    } catch (e) { return fail(e) }
  },
)

server.tool(
  'post_comment',
  'Post a comment/reply to one of your posts. account_id from list_accounts; target_id is the platform post/media/comment id to comment on. Supported: instagram, facebook, linkedin.',
  {
    account_id: z.string(),
    target_id: z.string().describe('The platform post/media/comment id to comment on.'),
    text: z.string(),
  },
  async (a) => { try { return ok(await api('POST', '/comments', { body: a })) } catch (e) { return fail(e) } },
)

server.tool(
  'list_keywords',
  'List the social-listening keywords this workspace tracks — id, keyword, role (brand/competitor/topic), platforms, aliases, active state. Mentions for them arrive via list_mentions.',
  {},
  async () => { try { return ok(await api('GET', '/listening/keywords')) } catch (e) { return fail(e) } },
)

server.tool(
  'add_keyword',
  'Start tracking a social-listening keyword. Per-plan keyword caps apply (Professional 5, Enterprise 15). Mentions are fetched on the listening pipeline\'s own cadence — there is no fetch-now; poll list_mentions for results.',
  {
    keyword: z.string().describe('The keyword to track (≤100 characters).'),
    role: z.enum(['brand', 'competitor', 'topic']).optional().describe('brand (default) vs competitor drives the Share of Voice report; topic is excluded from it.'),
    platforms: z.array(z.string()).optional().describe('Sources to search, e.g. ["reddit","bluesky","youtube","hackernews"]. Omit for the default set.'),
    aliases: z.array(z.string()).optional().describe('Alternate spellings (max 3). Each alias costs extra search quota.'),
    exclude_terms: z.array(z.string()).optional().describe('Skip mentions containing any of these.'),
    require_terms: z.array(z.string()).optional().describe('Only keep mentions containing at least one of these.'),
    brand_context: z.string().optional().describe('Short description of the brand, used by the AI relevancy scorer.'),
  },
  async (a) => { try { return ok(await api('POST', '/listening/keywords', { body: a })) } catch (e) { return fail(e) } },
)

server.tool(
  'update_keyword',
  'Edit a tracked keyword — including is_active=false to pause tracking without losing history.',
  {
    id: z.string().describe('Keyword id from list_keywords.'),
    keyword: z.string().optional(),
    role: z.enum(['brand', 'competitor', 'topic']).optional(),
    platforms: z.array(z.string()).optional(),
    aliases: z.array(z.string()).optional(),
    exclude_terms: z.array(z.string()).optional(),
    require_terms: z.array(z.string()).optional(),
    brand_context: z.string().optional(),
    is_active: z.boolean().optional().describe('false pauses tracking, true resumes.'),
  },
  async ({ id, ...body }) => { try { return ok(await api('PATCH', `/listening/keywords/${id}`, { body })) } catch (e) { return fail(e) } },
)

server.tool(
  'delete_keyword',
  'Stop tracking a keyword and drop its mentions. Prefer update_keyword with is_active=false if the user may want the history back.',
  { id: z.string() },
  async ({ id }) => { try { return ok(await api('DELETE', `/listening/keywords/${id}`)) } catch (e) { return fail(e) } },
)

server.tool(
  'get_listening_analytics',
  'Aggregated social-listening analytics: mention volume over time, per-platform split, sentiment distribution and trend, totals. Defaults to quality-filtered mentions.',
  {
    days: z.number().optional().describe('1-30, default 7 (capped by mention retention).'),
    keyword_id: z.string().optional().describe('Restrict to one keyword (id from list_keywords).'),
    include_low_relevancy: z.boolean().optional().describe('Include low-relevancy mentions the feed normally hides.'),
  },
  async (a) => {
    try {
      const query = { days: a.days, keyword_id: a.keyword_id }
      if (a.include_low_relevancy) query.include_low_relevancy = 'true'
      return ok(await api('GET', '/listening/analytics', { query }))
    } catch (e) { return fail(e) }
  },
)

server.tool(
  'get_share_of_voice',
  'Share of Voice report — your brand keywords vs competitor keywords: per-keyword mention/sentiment totals, your share of relevant conversation (current + previous window), daily series. Requires the Enterprise plan (403 otherwise — do not retry).',
  {
    days: z.number().optional().describe('1-90, default 30.'),
    platform: z.string().optional().describe('Restrict to one source, e.g. "reddit".'),
  },
  async (a) => { try { return ok(await api('GET', '/listening/share-of-voice', { query: a })) } catch (e) { return fail(e) } },
)

server.tool(
  'list_dm_automations',
  'List the DM automation rules on your Instagram/Facebook accounts, with per-rule funnel stats (reached → opted in → clicked, plus captured emails), this month\'s contact usage vs plan cap, and any accounts Meta is rate-limiting.',
  {},
  async () => { try { return ok(await api('GET', '/dm/automations')) } catch (e) { return fail(e) } },
)

server.tool(
  'create_dm_automation',
  'Create a DM automation rule. trigger_type: comment_keyword (comment → DM; REQUIRES opening_message + button_label — Meta\'s two-step opt-in, enforced), dm_keyword, story_reply_keyword, default_reply, or ref_link (campaign DM link; Instagram requires conversation starters on the account, verified at create — a 502 means the check could not run, retry). Sending always goes through the platform\'s pacing engine; there is no send-a-DM-now tool.',
  {
    platform: z.enum(['instagram', 'facebook']),
    account_id: z.string().describe('Account id from list_accounts.'),
    trigger_type: z.enum(['comment_keyword', 'dm_keyword', 'story_reply_keyword', 'default_reply', 'ref_link']),
    keywords: z.array(z.string()).optional().describe('Trigger keywords (required for *_keyword triggers; the campaign name for ref_link).'),
    match_type: z.enum(['exact', 'contains', 'begins_with']).optional().describe('Default "contains".'),
    reply_variants: z.array(z.string()).optional().describe('DM reply message(s) — one is rotated per send. Required unless ai_enabled.'),
    public_reply_variants: z.array(z.string()).optional().describe('comment_keyword only: public comment replies (e.g. "Check your DMs!").'),
    opening_message: z.string().optional().describe('comment_keyword: the opt-in DM shown with the button. Required for comment_keyword.'),
    button_label: z.string().optional().describe('comment_keyword: the opt-in button text. Required for comment_keyword.'),
    ai_enabled: z.boolean().optional().describe('AI-composed replies (not for comment_keyword). Requires ai_prompt.'),
    ai_prompt: z.string().optional().describe('Instructions for AI replies.'),
    name: z.string().optional(),
    once_per_user_hours: z.number().optional().describe('Per-person cooldown in hours. 0 disables.'),
    active: z.boolean().optional().describe('Default true. Set false to create paused.'),
  },
  async (a) => { try { return ok(await api('POST', '/dm/automations', { body: a })) } catch (e) { return fail(e) } },
)

server.tool(
  'update_dm_automation',
  'Edit a DM automation rule — most commonly active=false/true to pause or resume it. comment_keyword rules cannot drop opening_message or button_label.',
  {
    id: z.string().describe('Rule id from list_dm_automations.'),
    active: z.boolean().optional(),
    name: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    match_type: z.enum(['exact', 'contains', 'begins_with']).optional(),
    reply_variants: z.array(z.string()).optional(),
    public_reply_variants: z.array(z.string()).optional(),
    opening_message: z.string().optional(),
    button_label: z.string().optional(),
    ai_enabled: z.boolean().optional(),
    ai_prompt: z.string().optional(),
    once_per_user_hours: z.number().optional(),
  },
  async ({ id, ...body }) => { try { return ok(await api('PATCH', `/dm/automations/${id}`, { body })) } catch (e) { return fail(e) } },
)

server.tool(
  'delete_dm_automation',
  'Delete a DM automation rule permanently. Prefer update_dm_automation with active=false if the user may want it back.',
  { id: z.string() },
  async ({ id }) => { try { return ok(await api('DELETE', `/dm/automations/${id}`)) } catch (e) { return fail(e) } },
)

const transport = new StdioServerTransport()
await server.connect(transport)
// Keep this count in sync with the server.tool(...) blocks above.
console.error('Kadenzo MCP server running (stdio). 23 tools available.')
