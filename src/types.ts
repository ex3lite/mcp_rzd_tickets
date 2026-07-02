export type PlaceKind = "lower" | "upper" | "other";
export type CarTypeFilter = "coupe" | "platz" | string;

export interface SearchInput {
  origin: string;
  destination: string;
  date: string;
  adults?: number;
  children?: number;
  largeFamily?: boolean;
  originNodeId?: string;
  destinationNodeId?: string;
}

export interface TrainFilter {
  trains?: string[];
  train?: string;
  departureFrom?: string;
  departureTo?: string;
}

export interface CarFilter extends TrainFilter {
  carType?: CarTypeFilter;
  service?: string;
  maxPrice?: number;
  minPlaces?: number;
  placeKind?: PlaceKind;
  requirePair?: boolean;
  includeSide?: boolean;
  includeAccessible?: boolean;
}

export interface RzdStationSuggest {
  name: string;
  nodeId: string;
  expressCode?: string;
  description?: string;
  raw?: unknown;
}

export interface SeatStats {
  total: number;
  lower: number;
  upper: number;
  sideLower: number;
  sideUpper: number;
  side: number;
  other: number;
}

export interface ServiceClassInfo {
  code: string;
  title: string;
  tags: string[];
  transcript: string;
  description: string;
}

export interface TrainSummary {
  date: string;
  number: string;
  displayNumber: string;
  name: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  durationMinutes?: number;
  selected: boolean;
  totalPlaces: number;
  minPrice: number | null;
  placeStats: SeatStats;
  checkoutUrl: string;
  groups: CarGroupSummary[];
}

export interface CarGroupSummary {
  type: string;
  services: string[];
  serviceInfos: ServiceClassInfo[];
  places: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface CarSummary {
  train: string;
  car: string;
  type: string;
  service: string;
  serviceInfo: ServiceClassInfo;
  placeName: string;
  places: string;
  placeQuantity: number;
  placeStats: SeatStats;
  minPrice: number | null;
  accessible: boolean;
}

export interface AdjacentPair {
  train: string;
  car: string;
  carType: string;
  service: string;
  serviceInfo: ServiceClassInfo;
  compartment: string;
  lower: string;
  upper: string;
  minPrice: number | null;
  placeStats: SeatStats;
}

export interface TrainAvailability {
  train: TrainSummary;
  cars: CarSummary[];
  pairs: AdjacentPair[];
  matched: boolean;
  matchCount: number;
}

export interface RzdClientOptions {
  proxyUrl?: string;
  timeoutMs?: number;
}
