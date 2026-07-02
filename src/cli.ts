#!/usr/bin/env node
import { RzdClient, buildCheckoutUrl, parseSearchUrl } from "./index.js";
import type { CarFilter, SearchInput } from "./types.js";

const boolArgs = new Set(["help", "json", "require-pair", "include-side", "include-accessible", "large-family"]);

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    args[key] = boolArgs.has(key) ? true : argv[++i];
  }
  return args;
}

function searchInput(args: Record<string, string | boolean>): SearchInput {
  const fromUrl: Partial<SearchInput> = args.url ? parseSearchUrl(String(args.url)) : {};
  return {
    origin: String(args.origin || fromUrl.originNodeId || ""),
    destination: String(args.destination || fromUrl.destinationNodeId || ""),
    date: String(args.date || fromUrl.date || ""),
    adults: Number(args.adults || fromUrl.adults || 1),
    children: Number(args.children || fromUrl.children || 0),
    largeFamily: Boolean(args["large-family"]),
    originNodeId: String(args["origin-node-id"] || args.origin || fromUrl.originNodeId || ""),
    destinationNodeId: String(args["destination-node-id"] || args.destination || fromUrl.destinationNodeId || ""),
  };
}

function filter(args: Record<string, string | boolean>): CarFilter {
  return {
    train: args.train ? String(args.train) : undefined,
    trains: args.trains ? String(args.trains).split(",").map((item) => item.trim()).filter(Boolean) : undefined,
    departureFrom: args["departure-from"] ? String(args["departure-from"]) : undefined,
    departureTo: args["departure-to"] ? String(args["departure-to"]) : undefined,
    carType: args["car-type"] ? String(args["car-type"]) : undefined,
    service: args.service ? String(args.service) : undefined,
    maxPrice: args["max-price"] ? Number(args["max-price"]) : undefined,
    minPlaces: args["min-places"] ? Number(args["min-places"]) : undefined,
    placeKind: args["place-kind"] as CarFilter["placeKind"],
    requirePair: Boolean(args["require-pair"]),
    includeSide: Boolean(args["include-side"]),
    includeAccessible: Boolean(args["include-accessible"]),
  };
}

function printHelp() {
  console.log(`Usage:
  rzd-tickets --suggest "Красноярск"
  rzd-tickets --origin 2038000 --destination 2054275 --date 2026-07-12
  rzd-tickets --origin 2038000 --destination 2054275 --date 2026-07-12 --train 376Ы --require-pair --car-type coupe
  rzd-tickets --url "https://ticket.rzd.ru/searchresults/v/1/.../.../2026-8-11?adult=2" --require-pair

Options:
  --suggest QUERY
  --origin CODE_OR_NODE_ID
  --destination CODE_OR_NODE_ID
  --date YYYY-MM-DD
  --adults N
  --children N
  --train NUMBER
  --trains A,B
  --departure-from HH:mm
  --departure-to HH:mm
  --car-type coupe|platz|raw
  --service 2К|2А|2Ш|3Э
  --place-kind lower|upper|other
  --require-pair
  --include-side
  --include-accessible
  --checkout-url
  --json`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  const client = new RzdClient();
  if (args.suggest) {
    console.log(JSON.stringify(await client.suggestStations(String(args.suggest)), null, 2));
    return;
  }
  const search = searchInput(args);
  if (args["checkout-url"]) {
    console.log(buildCheckoutUrl(search));
    return;
  }
  const data = Object.keys(filter(args)).some((key) => filter(args)[key as keyof CarFilter] !== undefined && filter(args)[key as keyof CarFilter] !== false)
    ? await client.trainAvailability(search, filter(args))
    : await client.searchTrains(search, filter(args));
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
