# Agent Notes

Use this MCP server as a read-only RZD visibility layer.

Recommended flow:

1. Call `rzd_station_suggest` if the user gave station names instead of codes.
2. Call `rzd_search_trains` to see train-level availability.
3. Call `rzd_train_cars` for selected trains when seat position matters.
4. Call `rzd_find_places` with `requirePair=true` for adjacent lower+upper pairs.
5. Return `checkoutUrl` to the user for manual checkout.

Do not claim that a ticket is reserved. The server only reads public web-app
pricing endpoints.

Default safety filters:

- `includeAccessible=false`
- `includeSide=false` when the user asks for ordinary lower/upper places
- `requirePair=true` only when the user explicitly needs adjacent lower+upper
