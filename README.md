# mcp-w3c

W3C MCP — web-standards lookup over w3c/browser-specs (GitHub, CF-reachable).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `w3c_search` | Find W3C / web-standards specifications by keyword or topic — HTML, CSS, WCAG accessibility, DOM, SVG, WAI-ARIA, WebAuthn, Fetch, and 800+ others. Answers "what W3C spec defines X", "the CSS grid specification", "web accessibility standard", "which spec covers custom elements". Returns specs with shortname, title, status (Recommendation / Working Draft / Living Standard), organization, and official URL. Example: w3c_search({ query: "flexbox" }). |
| `w3c_spec` | Detail for one web-standards spec by shortname ("WCAG21", "css-grid-1", "html") or title fragment ("web content accessibility"). Returns title, status, organization (W3C/WHATWG), working groups, series, official URL, editor's-draft URL. Example: w3c_spec({ spec: "WCAG21" }). Accepts shortname/name/title too. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "w3c": {
      "url": "https://gateway.pipeworx.io/w3c/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about W3c data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
