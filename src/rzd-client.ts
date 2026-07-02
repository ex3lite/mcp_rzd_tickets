import proxyFetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { ProxyAgent } from "undici";
import type {
  AdjacentPair,
  CarImage,
  CarImageInfo,
  CarFilter,
  CarGroupSummary,
  CarSummary,
  PlaceKind,
  RzdClientOptions,
  RzdStationSuggest,
  SearchInput,
  SeatStats,
  ServiceClassInfo,
  TrainAvailability,
  TrainFilter,
  TrainSummary,
} from "./types.js";

const BASE = "https://ticket.rzd.ru";
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export const SERVICE_CLASS_DECODING_GUIDE = Object.freeze({
  policy: "ServiceClass is an open-ended RZD code. Do not treat it as a closed enum; prefer ServiceClassTranscript and ServiceClassName from the live RZD response.",
  fields: {
    code: "Raw RZD code, for example 2Ш or 3Э.",
    title: "Human label derived from RZD name, car type, or broad code family.",
    tags: "Facts extracted from RZD transcript when available, plus cautious code-family hints.",
    transcript: "Official RZD text. This is the best source when present.",
  },
  codeShape: [
    "The first digit is a rough family hint, not a guarantee.",
    "The letter differentiates tariff/service variants; exact meaning can change and should come from transcript.",
    "Agents should show the raw code together with title/tags/transcript instead of hiding it behind a local enum.",
  ],
});

interface RawTrain {
  TrainNumber?: string;
  DisplayTrainNumber?: string;
  TrainName?: string;
  TrainDescription?: string;
  OriginStationName?: string;
  DestinationStationName?: string;
  OriginStationCode?: string;
  DestinationStationCode?: string;
  InitialStationName?: string;
  FinalStationName?: string;
  LocalDepartureDateTime?: string;
  DepartureDateTime?: string;
  LocalArrivalDateTime?: string;
  ArrivalDateTime?: string;
  TripDuration?: number;
  Provider?: string;
  CarGroups?: RawCarGroup[];
}

interface RawCarGroup {
  CarType?: string;
  CarTypeName?: string;
  ServiceClasses?: string[];
  TotalPlaceQuantity?: number;
  PlaceQuantity?: number;
  MinPrice?: number;
  MaxPrice?: number;
}

interface RawCar {
  TrainNumber?: string;
  CarNumber?: string;
  CarType?: string;
  CarTypeName?: string;
  CarSubType?: string;
  Carrier?: string;
  CarrierDisplayName?: string;
  CarSchemeName?: string;
  CarNumeration?: string;
  HasImages?: boolean;
  RailwayCarSchemeId?: number | null;
  ServiceClass?: string;
  ServiceClassTranscript?: string;
  ServiceClassNameRu?: string;
  ServiceClassName?: string;
  CarPlaceNameRu?: string;
  CarPlaceName?: string;
  FreePlaces?: string;
  FreePlacesByCompartments?: Array<{ CompartmentNumber?: string; Places?: string }>;
  PlaceQuantity?: number;
  MinPrice?: number;
}

interface RawCarImage {
  RailwayCarImageId?: number;
  TitleRu?: string;
  TitleEn?: string;
  Preview?: string;
  Content?: string;
  SequenceNumber?: number;
}

interface RawCarImageList {
  SchemeId?: number;
  Images?: RawCarImage[];
}

interface ExpandedPlace {
  number: number;
  raw: string;
  kind: PlaceKind;
  side: boolean;
  compartment: string;
}

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeDate(value: string): string {
  const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error("date must be YYYY-MM-DD");
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function parseSearchUrl(value: string) {
  const url = new URL(value);
  const match = url.pathname.match(/\/searchresults\/v\/\d+\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Unable to parse RZD search URL");
  return {
    originNodeId: match[1],
    destinationNodeId: match[2],
    date: normalizeDate(match[3]),
    adults: Number(url.searchParams.get("adult") || 1),
    children: Number(url.searchParams.get("children") || 0),
  };
}

function selectedTrainNumbers(filter: TrainFilter = {}): string[] {
  const value = filter.trains?.length ? filter.trains : filter.train ? [filter.train] : [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function timeMinutes(value?: string): number | null {
  const m = String(value || "").match(/(?:T|^)(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function departureTimeMatches(train: RawTrain, filter: TrainFilter = {}): boolean {
  const from = timeMinutes(filter.departureFrom);
  const to = timeMinutes(filter.departureTo);
  if (from == null && to == null) return true;
  const current = timeMinutes(train.LocalDepartureDateTime || train.DepartureDateTime);
  if (current == null) return true;
  if (from != null && to != null && from > to) return current >= from || current <= to;
  if (from != null && current < from) return false;
  if (to != null && current > to) return false;
  return true;
}

export function filterTrain(train: RawTrain, filter: TrainFilter = {}): boolean {
  const selected = selectedTrainNumbers(filter);
  const number = String(train.TrainNumber || train.DisplayTrainNumber || "");
  return (!selected.length || selected.includes(number)) && departureTimeMatches(train, filter);
}

function carTypeMatches(car: RawCar, wanted?: string): boolean {
  if (!wanted) return true;
  const value = String(wanted).toLowerCase();
  const name = `${car.CarType || ""} ${car.CarTypeName || ""}`.toLowerCase();
  if (["coupe", "kupe", "купе"].includes(value)) return name.includes("compartment") || name.includes("купе");
  if (["platz", "platskart", "reserved", "плац", "плацкарт"].includes(value)) return name.includes("reservedseat") || name.includes("плац");
  return name.includes(value);
}

function transcriptTags(text: string): string[] {
  const value = cleanText(text).toLowerCase();
  return [
    value.includes("4-мест") && "4-местное купе",
    value.includes("открытого типа") && "открытый вагон",
    value.includes("белье входит") && "белье включено",
    value.includes("перевозки животных") && "животные разрешены",
    value.includes("животных запрещ") && "без животных",
    value.includes("кондиционер") && "кондиционер",
    value.includes("биотуалет") && "биотуалет",
  ].filter(Boolean) as string[];
}

function codeFamilyHint(code: string, type: string): string[] {
  const digit = code[0];
  const hints = [];
  if (digit === "1") hints.push("ориентир: высокий класс/СВ или люкс");
  if (digit === "2") hints.push("ориентир: купейный сегмент");
  if (digit === "3") hints.push("ориентир: плацкартный сегмент");
  if (digit === "4") hints.push("ориентир: сидячий сегмент");
  if (code.slice(1)) hints.push(`вариант ${code.slice(1)}: точный смысл брать из transcript РЖД`);
  if (type && !hints.some((item) => item.toLowerCase().includes(type.toLowerCase()))) hints.push(`тип вагона РЖД: ${type}`);
  return hints;
}

function titleFromCode(code: string): string {
  if (code.startsWith("1")) return "Сервисный класс РЖД высокого сегмента";
  if (code.startsWith("2")) return "Сервисный класс РЖД для купейного сегмента";
  if (code.startsWith("3")) return "Сервисный класс РЖД для плацкартного сегмента";
  if (code.startsWith("4")) return "Сервисный класс РЖД для сидячего сегмента";
  return "Сервисный класс РЖД";
}

export function serviceClassInfo(item: Partial<RawCar> & { code?: string; service?: string; type?: string; transcript?: string; name?: string } = {}): ServiceClassInfo {
  const code = cleanText(item.ServiceClass || item.service || item.code);
  const type = cleanText(item.CarTypeName || item.type);
  const transcript = cleanText(item.ServiceClassTranscript || item.transcript);
  const name = cleanText(item.ServiceClassNameRu || item.ServiceClassName || item.name);
  const title = name || type || (code ? titleFromCode(code) : "Класс не указан");
  const tags = [...new Set([...transcriptTags(transcript), ...codeFamilyHint(code, type)])];
  const details = [
    code && `код ${code}`,
    tags.length && tags.join(", "),
    transcript && `РЖД: ${transcript}`,
  ].filter(Boolean);
  return {
    code,
    title,
    tags,
    transcript,
    description: details.length ? `${title}: ${details.join("; ")}` : title,
  };
}

function placeKind(car: RawCar): { kind: PlaceKind; side: boolean } {
  const name = String(car.CarPlaceNameRu || car.CarPlaceName || "").toLowerCase();
  if (name.includes("ниж")) return { kind: "lower", side: name.includes("бок") };
  if (name.includes("верх")) return { kind: "upper", side: name.includes("бок") };
  return { kind: "other", side: false };
}

export function isAccessiblePlace(car: RawCar): boolean {
  const name = String(car.CarPlaceNameRu || car.CarPlaceName || "").toLowerCase();
  return name.includes("инвалид") || name.includes("сопровожда");
}

function placeNumbers(value?: string): Array<{ number: number; raw: string }> {
  return String(value || "")
    .split(",")
    .map((part) => {
      const raw = part.trim();
      const m = raw.match(/^(\d+)/);
      return m ? { number: Number(m[1]), raw } : null;
    })
    .filter(Boolean) as Array<{ number: number; raw: string }>;
}

function expandCarPlaces(car: RawCar): ExpandedPlace[] {
  const kind = placeKind(car);
  const compartments = car.FreePlacesByCompartments?.length
    ? car.FreePlacesByCompartments
    : [{ CompartmentNumber: "", Places: car.FreePlaces }];
  return compartments.flatMap((compartment) =>
    placeNumbers(compartment.Places).map((place) => ({
      ...place,
      ...kind,
      compartment: String(compartment.CompartmentNumber || ""),
    })),
  );
}

function emptyStats(): SeatStats {
  return { total: 0, lower: 0, upper: 0, sideLower: 0, sideUpper: 0, side: 0, other: 0 };
}

function summarizePlaces(places: ExpandedPlace[]): SeatStats {
  const stats = emptyStats();
  for (const place of places) {
    stats.total += 1;
    if (place.side) stats.side += 1;
    if (place.kind === "lower") {
      stats.lower += 1;
      if (place.side) stats.sideLower += 1;
    } else if (place.kind === "upper") {
      stats.upper += 1;
      if (place.side) stats.sideUpper += 1;
    } else {
      stats.other += 1;
    }
  }
  return stats;
}

export function filterCar(car: RawCar, filter: CarFilter = {}): boolean {
  if (car.CarType === "Baggage") return false;
  if (!filter.includeAccessible && isAccessiblePlace(car)) return false;
  if (!carTypeMatches(car, filter.carType)) return false;
  if (filter.service && car.ServiceClass !== filter.service) return false;
  if (filter.maxPrice != null && Number(car.MinPrice) > Number(filter.maxPrice)) return false;
  if (filter.minPlaces != null && Number(car.PlaceQuantity || 0) < Number(filter.minPlaces)) return false;
  if (filter.placeKind) {
    const kind = placeKind(car);
    if (kind.kind !== filter.placeKind) return false;
    if (!filter.includeSide && kind.side) return false;
  }
  return true;
}

export function placeStats(cars: RawCar[], filter: CarFilter = {}): SeatStats {
  const seen = new Set<string>();
  const places: ExpandedPlace[] = [];
  for (const car of cars.filter((item) => filterCar(item, filter))) {
    for (const place of expandCarPlaces(car)) {
      const key = [car.TrainNumber, car.CarNumber, place.compartment, place.number, place.kind, place.side].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }
  }
  return summarizePlaces(places);
}

export function findAdjacentPairs(cars: RawCar[], filter: CarFilter = {}, imageInfoByKey = new Map<string, CarImageInfo>(), train?: RawTrain): AdjacentPair[] {
  const groups = new Map<string, { car: RawCar; places: ExpandedPlace[] }>();
  for (const car of cars.filter((item) => filterCar(item, filter))) {
    const key = [car.TrainNumber, car.CarNumber, car.CarTypeName, car.ServiceClass, car.CarSubType].join("|");
    if (!groups.has(key)) groups.set(key, { car, places: [] });
    groups.get(key)!.places.push(...expandCarPlaces(car));
  }

  const pairs: AdjacentPair[] = [];
  for (const { car, places } of groups.values()) {
    const uppers = places.filter((place) => place.kind === "upper" && (filter.includeSide || !place.side));
    for (const lower of places.filter((place) => place.kind === "lower" && (filter.includeSide || !place.side))) {
      const upperNumber = lower.number % 2 === 1 ? lower.number + 1 : lower.number - 1;
      const upper = uppers.find((place) => place.compartment === lower.compartment && place.number === upperNumber);
      if (!upper) continue;
      pairs.push({
        train: String(car.TrainNumber || ""),
        car: String(car.CarNumber || ""),
        carType: String(car.CarTypeName || car.CarType || ""),
        service: String(car.ServiceClass || ""),
        serviceInfo: serviceClassInfo(car),
        compartment: lower.compartment,
        lower: lower.raw,
        upper: upper.raw,
        minPrice: car.MinPrice ?? null,
        placeStats: summarizePlaces(places),
        imageInfo: train ? imageInfoByKey.get(carImageKey(car, train)) || baseCarImageInfo(car, train) : undefined,
      });
    }
  }
  return pairs;
}

function toCarSummary(car: RawCar, imageInfo: CarImageInfo): CarSummary {
  return {
    train: String(car.TrainNumber || ""),
    car: String(car.CarNumber || ""),
    type: String(car.CarTypeName || car.CarType || ""),
    service: String(car.ServiceClass || ""),
    serviceInfo: serviceClassInfo(car),
    placeName: String(car.CarPlaceNameRu || car.CarPlaceName || ""),
    places: String(car.FreePlaces || ""),
    placeQuantity: Number(car.PlaceQuantity || 0),
    placeStats: placeStats([car], { includeAccessible: true, includeSide: true }),
    minPrice: car.MinPrice ?? null,
    accessible: isAccessiblePlace(car),
    imageInfo,
  };
}

function trainGroups(train: RawTrain): CarGroupSummary[] {
  return (train.CarGroups || []).map((group) => ({
    type: String(group.CarTypeName || group.CarType || ""),
    services: group.ServiceClasses || [],
    serviceInfos: (group.ServiceClasses || []).map((code) => serviceClassInfo({ ServiceClass: code, CarTypeName: group.CarTypeName || group.CarType })),
    places: Number(group.TotalPlaceQuantity ?? group.PlaceQuantity ?? 0),
    minPrice: group.MinPrice ?? null,
    maxPrice: group.MaxPrice ?? null,
  }));
}

function trainSummary(train: RawTrain, date: string, search: SearchInput, filter: CarFilter = {}, cars: RawCar[] = []): TrainSummary {
  const groups = trainGroups(train);
  const stats = cars.length
    ? placeStats(cars, filter)
    : emptyStats();
  const groupPlaces = groups.reduce((sum, group) => sum + group.places, 0);
  const prices = [
    ...groups.map((group) => group.minPrice).filter((value): value is number => typeof value === "number"),
    ...cars.map((car) => car.MinPrice).filter((value): value is number => typeof value === "number"),
  ];
  return {
    date,
    number: String(train.TrainNumber || ""),
    displayNumber: String(train.DisplayTrainNumber || train.TrainNumber || ""),
    name: String(train.TrainName || train.TrainDescription || ""),
    from: String(train.OriginStationName || ""),
    to: String(train.DestinationStationName || ""),
    departure: String(train.LocalDepartureDateTime || train.DepartureDateTime || ""),
    arrival: String(train.LocalArrivalDateTime || train.ArrivalDateTime || ""),
    durationMinutes: train.TripDuration,
    selected: filterTrain(train, filter),
    totalPlaces: stats.total || groupPlaces,
    minPrice: prices.length ? Math.min(...prices) : null,
    placeStats: stats,
    checkoutUrl: buildCheckoutUrl(search),
    groups,
  };
}

export function buildCheckoutUrl(input: SearchInput): string {
  const origin = input.originNodeId || input.origin;
  const destination = input.destinationNodeId || input.destination;
  const adults = input.adults ?? 1;
  const children = input.children ?? 0;
  const params = new URLSearchParams({ adult: String(adults) });
  if (children) params.set("children", String(children));
  return `${BASE}/searchresults/v/1/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}/${normalizeDate(input.date)}?${params}`;
}

export function buildPricingPath(input: Required<Pick<SearchInput, "origin" | "destination" | "date">> & SearchInput): string {
  const qs = new URLSearchParams({
    service_provider: "B2B_RZD",
    getByLocalTime: "true",
    carGrouping: "DontGroup",
    origin: input.origin,
    destination: input.destination,
    departureDate: `${normalizeDate(input.date)}T00:00:00`,
    specialPlacesDemand: "StandardPlacesAndForDisabledPersons",
    carIssuingType: "Passenger",
    getTrainsFromSchedule: "true",
    adultPassengersQuantity: String(input.adults ?? 1),
    childrenPassengersQuantity: String(input.children ?? 0),
    hasPlacesForLargeFamily: String(Boolean(input.largeFamily)),
  });
  return `/api/v1/railway-service/prices/train-pricing?${qs}`;
}

export function buildCarImageUrl(path: string): string {
  const imagePath = `/${String(path || "").replace(/^\/+/, "")}`;
  return `${BASE}/apib2b/p/Railway/V1/CarImage/Image${imagePath}?service_provider=B2B_RZD`;
}

function buildCarImageListPath(params: Record<string, string>): string {
  const qs = new URLSearchParams({ ...params, service_provider: "B2B_RZD" });
  return `/api/v1/railway-service/carimage/list?${qs}`;
}

function buildCarPricingBody(train: RawTrain, input: SearchInput) {
  return {
    OriginCode: train.OriginStationCode || input.origin,
    DestinationCode: train.DestinationStationCode || input.destination,
    Provider: train.Provider || "P1",
    DepartureDate: train.DepartureDateTime,
    TrainNumber: train.TrainNumber,
    SpecialPlacesDemand: "StandardPlacesAndForDisabledPersons",
    OnlyFpkBranded: false,
    HasPlacesForLargeFamily: Boolean(input.largeFamily),
    CarIssuingType: "Passenger",
  };
}

function carImageRequestParams(car: RawCar, train: RawTrain): Record<string, string> {
  const params = {
    Carrier: cleanText(car.CarrierDisplayName || car.Carrier),
    CarSubType: cleanText(car.CarSchemeName || car.CarSubType),
    CarNumber: cleanText(car.CarNumber),
    ServiceClass: cleanText(car.ServiceClass),
    TrainNumber: cleanText(train.TrainNumber || car.TrainNumber),
    DepartureDate: cleanText(train.DepartureDateTime || train.LocalDepartureDateTime),
    CarNumeration: cleanText(car.CarNumeration || "Unknown"),
  };
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
}

function carImageKey(car: RawCar, train: RawTrain): string {
  const params = carImageRequestParams(car, train);
  return [
    params.TrainNumber,
    params.DepartureDate,
    params.Carrier,
    params.CarSubType,
    params.CarNumber,
    params.ServiceClass,
    params.CarNumeration,
  ].join("|");
}

function baseCarImageInfo(car: RawCar, train: RawTrain): CarImageInfo {
  const params = carImageRequestParams(car, train);
  const hasImages = Boolean(car.HasImages);
  const canRequest = hasImages && ["Carrier", "CarSubType", "CarNumber", "ServiceClass", "TrainNumber", "DepartureDate"].every((key) => Boolean(params[key]));
  return {
    hasImages,
    fetched: false,
    schemeId: car.RailwayCarSchemeId ?? null,
    schemeName: cleanText(car.CarSchemeName),
    carSubType: cleanText(car.CarSubType),
    carrier: cleanText(car.CarrierDisplayName || car.Carrier),
    listUrl: canRequest ? `${BASE}${buildCarImageListPath(params)}` : null,
    requestParams: params,
    images: [],
    unavailableReason: hasImages
      ? canRequest
        ? "image list was not requested; call with includeImages=true"
        : "RZD marked the car as having images but did not provide enough car metadata for the image-list request"
      : "RZD CarPricing returned HasImages=false for this car",
  };
}

function mapCarImage(image: RawCarImage): CarImage {
  return {
    id: image.RailwayCarImageId ?? null,
    title: cleanText(image.TitleRu),
    titleEn: cleanText(image.TitleEn),
    sequence: image.SequenceNumber ?? null,
    thumbnailUrl: buildCarImageUrl(String(image.Preview || "")),
    contentUrl: buildCarImageUrl(String(image.Content || "")),
  };
}

export class RzdClient {
  private readonly proxyUrl: string;
  private readonly timeoutMs: number;
  private readonly dispatcher?: ProxyAgent;
  private readonly socksAgent?: SocksProxyAgent;
  private readonly cookies = new Map<string, string>();

  constructor(options: RzdClientOptions = {}) {
    this.proxyUrl = options.proxyUrl ?? process.env.RZD_PROXY_URL ?? "";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.RZD_TIMEOUT_MS || 20_000);
    this.dispatcher = /^https?:\/\//.test(this.proxyUrl) ? new ProxyAgent(this.proxyUrl) : undefined;
    this.socksAgent = /^socks/.test(this.proxyUrl) ? new SocksProxyAgent(this.proxyUrl) : undefined;
  }

  async suggestStations(query: string): Promise<RzdStationSuggest[]> {
    const data = await this.rzdJson(`/isdk/suggests?query=${encodeURIComponent(query)}`) as { transport_node_suggests?: Array<Record<string, any>> };
    return (data.transport_node_suggests || []).map((item) => ({
      name: String(item.Name || ""),
      nodeId: String(item.NodeId || ""),
      expressCode: item.Codes?.Railway ? String(item.Codes.Railway) : undefined,
      description: item.Description ? String(item.Description) : undefined,
      raw: item,
    }));
  }

  async resolveCode(value: string): Promise<string> {
    if (/^\d+$/.test(String(value))) return String(value);
    const object = await this.rzdJson(`/api/v1/getobject?id=${encodeURIComponent(value)}`) as { expressCode?: string };
    if (!object.expressCode) throw new Error(`Object ${value} has no expressCode`);
    return object.expressCode;
  }

  async normalizeSearch(input: SearchInput): Promise<SearchInput> {
    return {
      ...input,
      date: normalizeDate(input.date),
      adults: Number(input.adults ?? 1),
      children: Number(input.children ?? 0),
      origin: await this.resolveCode(input.origin),
      destination: await this.resolveCode(input.destination),
    };
  }

  async searchTrains(input: SearchInput, filter: TrainFilter = {}): Promise<TrainSummary[]> {
    const search = await this.normalizeSearch(input);
    const data = await this.rzdJson(buildPricingPath(search)) as { Trains?: RawTrain[] };
    return (data.Trains || [])
      .filter((train) => filterTrain(train, filter))
      .map((train) => trainSummary(train, search.date, search, filter));
  }

  async trainAvailability(input: SearchInput, filter: CarFilter = {}): Promise<TrainAvailability[]> {
    const search = await this.normalizeSearch(input);
    const data = await this.rzdJson(buildPricingPath(search)) as { Trains?: RawTrain[] };
    const trains = (data.Trains || []).filter((train) => filterTrain(train, filter));
    const result: TrainAvailability[] = [];
    for (const train of trains) {
      const cars = await this.searchCarsForTrain(train, search);
      const imageInfoByKey = filter.includeImages ? await this.fetchCarImageInfoMap(cars, train) : new Map<string, CarImageInfo>();
      const getImageInfo = (car: RawCar) => imageInfoByKey.get(carImageKey(car, train)) || baseCarImageInfo(car, train);
      const filteredCars = cars.filter((car) => filterCar(car, filter));
      const pairs = filter.requirePair ? findAdjacentPairs(cars, filter, imageInfoByKey, train) : [];
      const matched = filter.requirePair ? pairs.length > 0 : filteredCars.length > 0;
      result.push({
        train: trainSummary(train, search.date, search, filter, cars),
        cars: filteredCars.map((car) => toCarSummary(car, getImageInfo(car))),
        pairs,
        matched,
        matchCount: filter.requirePair ? pairs.length : filteredCars.length,
      });
    }
    return result;
  }

  async searchCars(input: SearchInput, filter: CarFilter = {}): Promise<TrainAvailability[]> {
    return this.trainAvailability(input, filter);
  }

  private async fetchCarImageInfoMap(cars: RawCar[], train: RawTrain): Promise<Map<string, CarImageInfo>> {
    const result = new Map<string, CarImageInfo>();
    const unique = new Map<string, RawCar>();
    for (const car of cars) {
      const key = carImageKey(car, train);
      if (!unique.has(key)) unique.set(key, car);
    }

    await Promise.all([...unique].map(async ([key, car]) => {
      const baseInfo = baseCarImageInfo(car, train);
      if (!baseInfo.hasImages || !baseInfo.listUrl) {
        result.set(key, baseInfo);
        return;
      }

      try {
        const data = await this.rzdJson(buildCarImageListPath(baseInfo.requestParams), {
          referer: buildCheckoutUrl({
            origin: String(train.OriginStationCode || ""),
            destination: String(train.DestinationStationCode || ""),
            date: String(train.DepartureDateTime || train.LocalDepartureDateTime || "").slice(0, 10) || "1970-01-01",
          }),
        }) as RawCarImageList;
        const images = (data.Images || [])
          .slice()
          .sort((left, right) => Number(left.SequenceNumber ?? 0) - Number(right.SequenceNumber ?? 0))
          .map(mapCarImage);
        result.set(key, {
          ...baseInfo,
          fetched: true,
          schemeId: data.SchemeId ?? baseInfo.schemeId,
          images,
          unavailableReason: images.length ? undefined : "RZD image-list endpoint returned no images for this car",
        });
      } catch (error) {
        result.set(key, {
          ...baseInfo,
          error: error instanceof Error ? error.message : String(error),
          unavailableReason: "RZD image-list request failed",
        });
      }
    }));

    return result;
  }

  private async searchCarsForTrain(train: RawTrain, input: SearchInput): Promise<RawCar[]> {
    const data = await this.rzdJson("/apib2b/p/Railway/V1/Search/CarPricing?service_provider=B2B_RZD&isBonusPurchase=false", {
      method: "POST",
      body: buildCarPricingBody(train, input),
    }) as { Cars?: RawCar[] };
    return data.Cars || [];
  }

  private cookieHeader(): string {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  private rememberCookies(res: Response): void {
    const headers = res.headers as Headers & { getSetCookie?: () => string[]; raw?: () => Record<string, string[]> };
    const values = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : typeof headers.raw === "function"
        ? headers.raw()["set-cookie"] || []
        : [headers.get("set-cookie")].filter(Boolean) as string[];
    for (const header of values) {
      const first = header.split(";", 1)[0];
      const eq = first.indexOf("=");
      if (eq > 0) this.cookies.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }

  private async rzdJson(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; referer?: string } = {}) {
    const res = await this.rzdRequest(path, init);
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }

  private async rzdRequest(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; referer?: string } = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": CHROME_UA,
      "x-client-id": "22900",
      origin: BASE,
      referer: init.referer || `${BASE}/`,
      ...init.headers,
    };
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    try {
      const requestInit = {
        method: init.method || "GET",
        body: init.body == null ? undefined : JSON.stringify(init.body),
        headers,
        signal: controller.signal,
      };
      const res = this.socksAgent
        ? await proxyFetch(`${BASE}${path}`, { ...requestInit, agent: this.socksAgent } as any) as unknown as Response
        : await fetch(`${BASE}${path}`, this.dispatcher ? { ...requestInit, dispatcher: this.dispatcher } as any : requestInit);
      this.rememberCookies(res);
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }
}
