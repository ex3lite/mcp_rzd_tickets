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

Service classes:

- Do not treat `ServiceClass` as a closed enum.
- Show the raw code together with `serviceInfo.description`.
- Prefer `serviceInfo.transcript` when RZD provides it.

Car photos:

- `rzd_train_cars` and `rzd_find_places` include `imageInfo` by default.
- Show `imageInfo.images[].contentUrl` when the user asks what the car looks like.
- If `imageInfo.hasImages=false`, say that RZD does not publish photos for that car.
- If `imageInfo.error` exists, keep the ticket/seat result and report that only photo loading failed.

Default safety filters:

- `includeAccessible=false`
- `includeSide=false` when the user asks for ordinary lower/upper places
- `requirePair=true` only when the user explicitly needs adjacent lower+upper
