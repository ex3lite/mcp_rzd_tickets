<p align="center">
  <img src="../assets/logo.png" alt="RZD Tickets MCP logo" width="140" />
</p>

# RZD Tickets MCP

Read-only MCP server that gives AI agents live visibility into `ticket.rzd.ru`:
trains, cars, prices, lower/upper seats, side places, accessible places,
adjacent lower+upper pairs, car photos when RZD publishes them, and official
RZD checkout handoff URLs.

It does not log in, book, hold, pay, cancel, or modify RZD orders.

## Tools

| Tool | Purpose |
|---|---|
| `rzd_station_suggest` | Find station `nodeId` and `expressCode` by name. |
| `rzd_search_trains` | Train-level availability, prices, car groups and checkout URL. |
| `rzd_train_cars` | Drill into `CarPricing`: cars, seats, lower/upper stats, photos. |
| `rzd_find_places` | Return only matched trains/cars/pairs by filters, including car photos. |
| `rzd_checkout_url` | Build the official RZD handoff URL. |
| `rzd_parse_search_url` | Parse an existing `ticket.rzd.ru/searchresults` URL. |
| `rzd_service_classes` | Explain how to read open-ended RZD service class codes. |

## Quick Start

```bash
git clone git@github.com:ex3lite/mcp_rzd_tickets.git
cd mcp_rzd_tickets
npm install
npm run build
```

Run as an MCP stdio server:

```bash
node dist/mcp.js
```

The package is published to npm as `mcp-rzd-tickets`, so most agents can run it
without clone/build:

```bash
npx -y mcp-rzd-tickets
```

### Claude Code

Global install:

```bash
claude mcp add -s user rzd_tickets -- npx -y mcp-rzd-tickets
claude mcp list
```

Project-only install:

```bash
claude mcp add -s project rzd_tickets -- npx -y mcp-rzd-tickets
```

### Codex

```bash
codex mcp add rzd_tickets --env RZD_TIMEOUT_MS=20000 -- npx -y mcp-rzd-tickets
codex mcp list
```

Codex may need a new session or restart after changing MCP config.

### Claude Desktop, Cursor, Windsurf, Cline, Roo Code

Use the same JSON block in clients that support MCP JSON config:

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "npx",
      "args": ["-y", "mcp-rzd-tickets"],
      "env": {
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

Common locations:

| Client | Location |
|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json`, under `mcpServers`. |
| Cursor | `~/.cursor/mcp.json` globally or `.cursor/mcp.json` in a project. |
| Windsurf | Settings → Cascade/MCP → Add custom server, then paste the JSON block. |
| Cline | MCP Servers → Configure MCP Servers or `~/.cline/mcp.json`. |
| Roo Code | MCP Servers → Edit Global MCP / Edit Project MCP. |

### Continue

Continue can read JSON MCP configs, but its native block format is YAML. Create
`.continue/mcpServers/rzd-tickets.yaml`:

```yaml
name: RZD Tickets MCP
version: 0.1.2
schema: v1
mcpServers:
  - name: rzd_tickets
    command: npx
    args:
      - -y
      - mcp-rzd-tickets
```

Proxy is disabled by default. Set `RZD_PROXY_URL` only when direct RZD requests
do not work from your network.

## Filters

- `trains`: exact train numbers, for example `["097Э"]`.
- `departureFrom` / `departureTo`: local time window, `HH:mm`.
- `carType`: `coupe`, `platz`, or raw RZD car type text.
- `service`: raw RZD service class code. The code set is open-ended.
- `placeKind`: `lower`, `upper`, or `other`.
- `requirePair`: adjacent lower+upper pair in the same compartment.
- `includeSide`: include side places.
- `includeAccessible`: include disabled/special places.
- `includeImages`: fetch car gallery URLs when RZD returns `HasImages=true`; enabled by default in MCP.
- `maxPrice`, `minPlaces`: price and row-level place filters.

## Car Photos

`rzd_train_cars` and `rzd_find_places` return `imageInfo` for every car.
Use `imageInfo.images[].thumbnailUrl` for previews and
`imageInfo.images[].contentUrl` for full-size photos.

RZD does not publish photos for every car. When `CarPricing` returns
`HasImages=false`, the server leaves `images` empty and explains the reason in
`imageInfo.unavailableReason`.

## Service Classes

RZD service classes are not modeled as a local enum.

The server returns:

- `code`: raw RZD code;
- `title`: label from RZD response, car type, or broad code-family hint;
- `tags`: extracted facts from `ServiceClassTranscript` and cautious hints;
- `transcript`: official RZD text when present;
- `description`: display-ready text.

## Publishing

Primary route:

```bash
npm publish --access public
mcp-publisher login github
mcp-publisher publish
```

`server.json` is ready for the official MCP Registry as
`io.github.ex3lite/mcp-rzd-tickets`. The registry stores metadata; the runnable
artifact should be the public npm package `mcp-rzd-tickets`.

Smithery is also possible. This stdio server needs an MCPB bundle for local
distribution; Smithery URL publishing requires a separate Streamable HTTP
endpoint.

Agents should show the raw code with `description` and prefer `transcript`
when available. This keeps the server useful when RZD introduces new codes.
