<p align="center">
  <img src="./assets/logo.png" alt="RZD Tickets MCP logo" width="140" />
</p>

# RZD Tickets MCP

Read-only MCP server that gives AI agents live visibility into
`ticket.rzd.ru`: trains, car classes, lower/upper seats, side places,
accessible places, adjacent lower+upper pairs, prices, and official checkout
handoff URLs.

It does not log in, book, hold, pay, cancel, or modify RZD orders.

## Tools

| Tool | Purpose |
|---|---|
| `rzd_station_suggest` | Find station `nodeId` and `expressCode` by name. |
| `rzd_search_trains` | Train-level availability, prices, car groups and checkout URL. |
| `rzd_train_cars` | Drill into cars and free places for selected trains. |
| `rzd_find_places` | Return only matched trains/cars/pairs by filters. |
| `rzd_checkout_url` | Build the official RZD handoff URL. |
| `rzd_parse_search_url` | Parse an existing `ticket.rzd.ru/searchresults` URL. |
| `rzd_service_classes` | Explain service classes such as `2Ш`, `2К`, `2А`, `3Э`. |

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

Run directly from GitHub in MCP clients that support `npx`:

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "npx",
      "args": ["-y", "--package", "github:ex3lite/mcp_rzd_tickets", "rzd-tickets-mcp"],
      "env": {
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

Or use the CLI for a direct check:

```bash
node dist/cli.js --suggest "Красноярск"
node dist/cli.js --origin 2038000 --destination 2054275 --date 2026-07-12 --train 376Ы --require-pair --car-type coupe
```

## Agent Configuration

Use the same stdio config shape in Claude Desktop, Cursor, Windsurf, Cline,
Roo Code, Continue and Codex-compatible MCP hosts:

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_rzd_tickets/dist/mcp.js"],
      "env": {
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

With a SOCKS proxy:

```json
{
  "mcpServers": {
    "rzd_tickets": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_rzd_tickets/dist/mcp.js"],
      "env": {
        "RZD_PROXY_URL": "socks5://user:pass@host:1080",
        "RZD_TIMEOUT_MS": "20000"
      }
    }
  }
}
```

## Common Agent Prompts

```text
Find trains from Красноярск Пасс to Анзеби on 2026-07-12.
Show whether train 376Ы has adjacent lower+upper coupe places.
Exclude side places and disabled/special places.
Return the checkout URL if a match exists.
```

```text
Use rzd_station_suggest for "Анзеби" and "Красноярск".
Then search 2 passengers on 2026-07-03 for train 097Э.
I need a lower+upper pair in one compartment.
```

## Filters

- `trains`: exact train numbers, for example `["097Э"]`.
- `departureFrom` / `departureTo`: local time window, `HH:mm`.
- `carType`: `coupe`, `platz`, or raw RZD car type text.
- `service`: class code such as `2К`, `2А`, `2Ш`, `3Э`.
- `placeKind`: `lower`, `upper`, or `other`.
- `requirePair`: adjacent lower+upper pair in the same compartment.
- `includeSide`: include side places.
- `includeAccessible`: include disabled/special places.
- `maxPrice`, `minPlaces`: price and row-level place filters.

## Environment

| Variable | Description |
|---|---|
| `RZD_PROXY_URL` | Optional `http://`, `https://`, `socks4://` or `socks5://` proxy. |
| `RZD_TIMEOUT_MS` | Request timeout. Default: `20000`. |

## Notes

RZD can change private web endpoints without notice. This server uses the same
read-only pricing endpoints that the public web app uses and browser-like
headers. If RZD changes payloads, keep the failure visible to the agent instead
of hiding it.

## Languages

- [Русский](./docs/README.ru.md)
- [English](./README.md)
- [中文](./docs/README.zh.md)
