# Security

`rzd_tickets` is intentionally read-only.

It can:

- search stations;
- read RZD train pricing results;
- inspect car pricing and free places;
- report lower/upper/side/accessible seats;
- build a checkout page URL.

It does not:

- log in to an RZD account;
- create holds or bookings;
- enter passenger data;
- submit payment;
- cancel or modify existing orders.

If you expose this MCP server through a remote bridge, put authentication and
rate limits in front of that bridge. The default stdio transport is local-only.
