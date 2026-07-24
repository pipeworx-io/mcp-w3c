interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * W3C MCP — web-standards lookup over w3c/browser-specs (GitHub, CF-reachable).
 * ~800 current web specs (W3C + WHATWG): HTML, CSS, WCAG, DOM, SVG, ARIA,
 * WebAuthn, Fetch, etc. api.w3.org BLOCKS Cloudflare egress (403) — browser-
 * specs on raw.githubusercontent.com is CF-reachable and a cleaner one-file
 * index. Fetched once, cached in-isolate 24h.
 */

const INDEX_URL = 'https://raw.githubusercontent.com/w3c/browser-specs/main/index.json';
const UA = 'pipeworx-mcp-w3c/1.0 (+https://pipeworx.io)';
const TTL_MS = 24 * 60 * 60 * 1000;

interface Spec {
  url: string; shortname: string; title: string; shortTitle?: string;
  series?: { shortname?: string; currentSpecification?: string };
  groups?: Array<{ name?: string }>; organization?: string;
  nightly?: { url?: string; status?: string }; release?: { url?: string; status?: string }; standing?: string;
}

let CACHE: { at: number; specs: Spec[] } | null = null;
async function getSpecs(): Promise<Spec[]> {
  if (CACHE && Date.now() - CACHE.at < TTL_MS) return CACHE.specs;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(INDEX_URL, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`W3C spec index unavailable (HTTP ${res.status}); retry shortly.`);
    const specs = (await res.json()) as Spec[];
    CACHE = { at: Date.now(), specs };
    return specs;
  } finally { clearTimeout(timer); }
}

const statusOf = (s: Spec): string | null => s.release?.status ?? s.nightly?.status ?? null;
const shape = (s: Spec) => ({ shortname: s.shortname, title: s.title, status: statusOf(s), organization: s.organization ?? null, url: s.release?.url ?? s.url });
const shapeDetail = (s: Spec) => ({
  shortname: s.shortname, title: s.title, short_title: s.shortTitle ?? null, status: statusOf(s),
  organization: s.organization ?? null, groups: (s.groups ?? []).map((g) => g.name).filter(Boolean),
  series: s.series?.shortname ?? null, url: s.release?.url ?? s.url, editors_draft_url: s.nightly?.url ?? null, source: 'w3c/browser-specs',
});
const FLAGSHIP = /^(wcag|wai-aria|html|dom|css-|svg|webauthn|fetch|url|encoding|ecmascript)/i;
const tokens = (q: string): string[] => q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);

const tools: McpToolExport['tools'] = [
  {
    name: 'w3c_search',
    description: 'Find W3C / web-standards specifications by keyword or topic — HTML, CSS, WCAG accessibility, DOM, SVG, WAI-ARIA, WebAuthn, Fetch, and 800+ others. Answers "what W3C spec defines X", "the CSS grid specification", "web accessibility standard", "which spec covers custom elements". Returns specs with shortname, title, status (Recommendation / Working Draft / Living Standard), organization, and official URL. Example: w3c_search({ query: "flexbox" }).',
    inputSchema: { type: 'object' as const, properties: { query: { type: 'string', description: 'Keyword(s) matched against spec titles, e.g. "flexbox", "accessibility", "web components".' }, limit: { type: 'number', description: 'Max results 1-25 (default 10).' } }, required: ['query'] },
  },
  {
    name: 'w3c_spec',
    description: 'Detail for one web-standards spec by shortname ("WCAG21", "css-grid-1", "html") or title fragment ("web content accessibility"). Returns title, status, organization (W3C/WHATWG), working groups, series, official URL, editor\'s-draft URL. Example: w3c_spec({ spec: "WCAG21" }). Accepts shortname/name/title too.',
    inputSchema: { type: 'object' as const, properties: { spec: { type: 'string', description: 'Spec shortname or title fragment.' } }, required: [] },
  },
];

async function search(args: Record<string, unknown>) {
  const query = String(args.query ?? args.q ?? args.keyword ?? '').trim();
  if (!query) throw new Error('w3c_search requires a query, e.g. { query: "accessibility" }.');
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
  const toks = tokens(query); const specs = await getSpecs(); const ql = query.toLowerCase();
  const scored = specs.map((s) => {
    const hay = `${s.title} ${s.shortname} ${s.shortTitle ?? ''}`.toLowerCase();
    if (!toks.every((t) => hay.includes(t))) return null;
    let score = 0;
    if (s.shortname.toLowerCase().includes(ql)) score += 5;
    if (s.title.toLowerCase().includes(ql)) score += 3;
    if (FLAGSHIP.test(s.shortname)) score += 2;
    if (statusOf(s) === 'Recommendation') score += 1;
    score -= s.title.length / 200;
    return { s, score };
  }).filter((x): x is { s: Spec; score: number } => x !== null).sort((a, b) => b.score - a.score);
  return { query, total_matches: scored.length, count: Math.min(scored.length, limit), specs: scored.slice(0, limit).map((x) => shape(x.s)), source: 'w3c/browser-specs (keyless)' };
}

async function spec(args: Record<string, unknown>) {
  const raw = String(args.spec ?? args.shortname ?? args.name ?? args.title ?? args.query ?? '').trim();
  if (!raw) throw new Error('Provide a spec shortname ("WCAG21", "css-grid-1") or title fragment via `spec`.');
  const specs = await getSpecs(); const lc = raw.toLowerCase();
  let hit = specs.find((s) => s.shortname.toLowerCase() === lc)
    ?? specs.find((s) => s.series?.shortname?.toLowerCase() === lc && s.shortname === s.series?.currentSpecification)
    ?? specs.find((s) => s.series?.shortname?.toLowerCase() === lc);
  if (!hit) {
    const toks = tokens(raw);
    const cands = specs.filter((s) => { const hay = `${s.title} ${s.shortname}`.toLowerCase(); return toks.every((t) => hay.includes(t)); })
      .sort((a, b) => (FLAGSHIP.test(b.shortname) ? 1 : 0) - (FLAGSHIP.test(a.shortname) ? 1 : 0) || a.title.length - b.title.length);
    hit = cands[0];
    if (!hit) {
      const near = specs.filter((s) => tokens(raw).some((t) => `${s.title} ${s.shortname}`.toLowerCase().includes(t))).slice(0, 5).map((s) => ({ shortname: s.shortname, title: s.title }));
      return { spec: raw, found: false, message: `No W3C spec matched "${raw}".`, closest: near };
    }
  }
  return { found: true, ...shapeDetail(hit) };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) { case 'w3c_search': return search(args); case 'w3c_spec': return spec(args); default: throw new Error(`Unknown tool: ${name}`); }
}
export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
