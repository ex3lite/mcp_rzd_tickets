#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  RzdClient,
  SERVICE_CLASS_OPTIONS,
  buildCheckoutUrl,
  parseSearchUrl,
} from "./index.js";
import type { CarFilter, SearchInput, TrainFilter } from "./types.js";

const version = "0.1.0";
const client = new RzdClient();

const searchShape = {
  origin: z.string().describe("RZD expressCode or nodeId of origin station, e.g. 2038000 or 5a13..."),
  destination: z.string().describe("RZD expressCode or nodeId of destination station."),
  date: z.string().describe("Travel date in YYYY-MM-DD."),
  adults: z.number().int().min(1).max(9).default(1).describe("Adult passengers."),
  children: z.number().int().min(0).max(9).default(0).describe("Child passengers."),
  largeFamily: z.boolean().default(false).describe("Search large-family availability."),
  originNodeId: z.string().optional().describe("Optional nodeId for building checkout URL."),
  destinationNodeId: z.string().optional().describe("Optional nodeId for building checkout URL."),
};

const trainFilterShape = {
  trains: z.array(z.string()).optional().describe("Exact train numbers, e.g. [\"097Э\"]."),
  train: z.string().optional().describe("Single exact train number."),
  departureFrom: z.string().optional().describe("Local departure lower bound HH:mm."),
  departureTo: z.string().optional().describe("Local departure upper bound HH:mm."),
};

const carFilterShape = {
  ...trainFilterShape,
  carType: z.string().optional().describe("coupe, platz, or raw RZD car type text."),
  service: z.string().optional().describe("Service class code, e.g. 2К, 2А, 2Ш, 3Э."),
  maxPrice: z.number().optional().describe("Maximum price in RUB."),
  minPlaces: z.number().int().min(0).optional().describe("Minimum places in a car row."),
  placeKind: z.enum(["lower", "upper", "other"]).optional().describe("Seat kind filter."),
  requirePair: z.boolean().default(false).describe("Return only adjacent lower+upper pairs."),
  includeSide: z.boolean().default(false).describe("Include side places."),
  includeAccessible: z.boolean().default(false).describe("Include disabled/special places."),
};

function ok(data: Record<string, unknown>) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function searchInput(args: z.infer<z.ZodObject<typeof searchShape>>): SearchInput {
  return {
    origin: args.origin,
    destination: args.destination,
    date: args.date,
    adults: args.adults,
    children: args.children,
    largeFamily: args.largeFamily,
    originNodeId: args.originNodeId,
    destinationNodeId: args.destinationNodeId,
  };
}

function trainFilter(args: Partial<z.infer<z.ZodObject<typeof trainFilterShape>>>): TrainFilter {
  return {
    trains: args.trains,
    train: args.train,
    departureFrom: args.departureFrom,
    departureTo: args.departureTo,
  };
}

function carFilter(args: Partial<z.infer<z.ZodObject<typeof carFilterShape>>>): CarFilter {
  return {
    ...trainFilter(args),
    carType: args.carType,
    service: args.service,
    maxPrice: args.maxPrice,
    minPlaces: args.minPlaces,
    placeKind: args.placeKind,
    requirePair: args.requirePair,
    includeSide: args.includeSide,
    includeAccessible: args.includeAccessible,
  };
}

export function createServer() {
  const server = new McpServer({
    name: "rzd_tickets",
    version,
  });

  server.registerTool("rzd_station_suggest", {
    title: "Suggest RZD stations",
    description: "Find RZD station nodeId and expressCode by station name.",
    inputSchema: {
      query: z.string().min(2).describe("Station name fragment, e.g. Красноярск or Анзеби."),
    },
    annotations: { readOnlyHint: true },
  }, async ({ query }) => ok({ stations: await client.suggestStations(query) }));

  server.registerTool("rzd_search_trains", {
    title: "Search RZD trains",
    description: "Return train-level availability, prices, car groups and checkout URL for a route/date.",
    inputSchema: {
      ...searchShape,
      ...trainFilterShape,
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    const trains = await client.searchTrains(searchInput(args), trainFilter(args));
    return ok({ trains, count: trains.length });
  });

  server.registerTool("rzd_train_cars", {
    title: "Inspect RZD train cars",
    description: "Drill into CarPricing for selected trains and return cars, seat stats, lower/upper places, and adjacent pairs.",
    inputSchema: {
      ...searchShape,
      ...carFilterShape,
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    const result = await client.trainAvailability(searchInput(args), carFilter(args));
    return ok({ trains: result, count: result.length });
  });

  server.registerTool("rzd_find_places", {
    title: "Find matching RZD places",
    description: "Search trains and return only matches by seat/car filters. Use requirePair=true for adjacent lower+upper places.",
    inputSchema: {
      ...searchShape,
      ...carFilterShape,
    },
    annotations: { readOnlyHint: true },
  }, async (args) => {
    const trains = await client.trainAvailability(searchInput(args), carFilter(args));
    const matches = trains.filter((item) => item.matched);
    return ok({ matches, count: matches.length });
  });

  server.registerTool("rzd_checkout_url", {
    title: "Build RZD checkout URL",
    description: "Build the official RZD search/checkout handoff URL. This tool does not book or pay.",
    inputSchema: searchShape,
    annotations: { readOnlyHint: true },
  }, async (args) => ok({ url: buildCheckoutUrl(searchInput(args)) }));

  server.registerTool("rzd_parse_search_url", {
    title: "Parse RZD search URL",
    description: "Extract route nodeIds, date and passengers from an official ticket.rzd.ru search URL.",
    inputSchema: {
      url: z.string().url(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ url }) => ok(parseSearchUrl(url)));

  server.registerTool("rzd_service_classes", {
    title: "Explain RZD service classes",
    description: "Return known human-readable service class enum values such as 2Ш, 2К, 2А, 3Э.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => ok({ classes: SERVICE_CLASS_OPTIONS }));

  return server;
}

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
