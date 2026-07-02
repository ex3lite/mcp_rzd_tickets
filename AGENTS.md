# Agent Guide

This repository contains a read-only MCP server for RZD ticket visibility.

Use `npm run build` before running `node dist/mcp.js`.

Primary files:

- `src/mcp.ts` registers MCP tools.
- `src/rzd-client.ts` contains all RZD HTTP and seat parsing logic.
- `src/types.ts` contains the public typed output contract.
- `docs/AGENTS.md` describes recommended tool flow for agents.

Do not add booking, payment, cancellation, or account mutation features here.
The server is intentionally read-only.
