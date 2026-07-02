<p align="center">
  <img src="../assets/logo.png" alt="RZD Tickets MCP logo" width="140" />
</p>

# RZD Tickets MCP

Read-only MCP server that gives AI agents live visibility into `ticket.rzd.ru`:
trains, cars, prices, lower/upper seats, side places, accessible places,
adjacent lower+upper pairs, and official RZD checkout handoff URLs.

It does not log in, book, hold, pay, cancel, or modify RZD orders.

## Tools

| Tool | Purpose |
|---|---|
| `rzd_station_suggest` | Find station `nodeId` and `expressCode` by name. |
| `rzd_search_trains` | Train-level availability, prices, car groups and checkout URL. |
| `rzd_train_cars` | Drill into `CarPricing`: cars, seats, lower/upper stats. |
| `rzd_find_places` | Return only matched trains/cars/pairs by filters. |
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

## Filters

- `trains`: exact train numbers, for example `["097Э"]`.
- `departureFrom` / `departureTo`: local time window, `HH:mm`.
- `carType`: `coupe`, `platz`, or raw RZD car type text.
- `service`: raw RZD service class code. The code set is open-ended.
- `placeKind`: `lower`, `upper`, or `other`.
- `requirePair`: adjacent lower+upper pair in the same compartment.
- `includeSide`: include side places.
- `includeAccessible`: include disabled/special places.
- `maxPrice`, `minPlaces`: price and row-level place filters.

## Service Classes

RZD service classes are not modeled as a local enum.

The server returns:

- `code`: raw RZD code;
- `title`: label from RZD response, car type, or broad code-family hint;
- `tags`: extracted facts from `ServiceClassTranscript` and cautious hints;
- `transcript`: official RZD text when present;
- `description`: display-ready text.

Agents should show the raw code with `description` and prefer `transcript`
when available. This keeps the server useful when RZD introduces new codes.
