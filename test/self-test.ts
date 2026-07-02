import assert from "node:assert/strict";
import {
  buildCheckoutUrl,
  buildPricingPath,
  filterCar,
  filterTrain,
  findAdjacentPairs,
  normalizeDate,
  parseSearchUrl,
  placeStats,
  serviceClassInfo,
} from "../src/index.js";

const parsed = parseSearchUrl("https://ticket.rzd.ru/searchresults/v/1/a/b/2026-8-11?adult=2");
assert.deepEqual(parsed, { originNodeId: "a", destinationNodeId: "b", date: "2026-08-11", adults: 2, children: 0 });
assert.equal(normalizeDate("2026-8-1"), "2026-08-01");
assert.equal(buildPricingPath({ origin: "2054275", destination: "2038000", date: "2026-08-11" }).includes("origin=2054275"), true);
assert.equal(buildCheckoutUrl({ origin: "a", destination: "b", date: "2026-08-11", adults: 2 }), "https://ticket.rzd.ru/searchresults/v/1/a/b/2026-08-11?adult=2");

const cars = [
  { TrainNumber: "1", CarNumber: "1", CarTypeName: "КУПЕ", ServiceClass: "2К", CarSubType: "x", CarPlaceNameRu: "Нижнее", FreePlacesByCompartments: [{ CompartmentNumber: "1", Places: "1" }] },
  { TrainNumber: "1", CarNumber: "1", CarTypeName: "КУПЕ", ServiceClass: "2К", CarSubType: "x", CarPlaceNameRu: "Верхнее", FreePlacesByCompartments: [{ CompartmentNumber: "1", Places: "2" }] },
];

assert.equal(findAdjacentPairs(cars, {}).length, 1);
assert.deepEqual(placeStats(cars), { total: 2, lower: 1, upper: 1, sideLower: 0, sideUpper: 0, side: 0, other: 0 });
assert.equal(filterTrain({ TrainNumber: "1", LocalDepartureDateTime: "2026-08-11T23:30:00" }, { trains: ["1"], departureFrom: "22:00", departureTo: "02:00" }), true);
assert.equal(filterCar({ CarPlaceNameRu: "Для инвалидов, нижнее" }, { placeKind: "lower" }), false);
assert.equal(filterCar({ CarPlaceNameRu: "Для инвалидов, нижнее" }, { placeKind: "lower", includeAccessible: true }), true);
assert.equal(serviceClassInfo({ ServiceClass: "2Ш" }).code, "2Ш");
assert.equal(serviceClassInfo({ ServiceClass: "2Ш" }).tags.includes("ориентир: купейный сегмент"), true);
assert.equal(serviceClassInfo({ ServiceClass: "2Ш" }).description.includes("код 2Ш"), true);

console.log("ok");
