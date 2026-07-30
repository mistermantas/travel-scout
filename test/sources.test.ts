import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { generateDateWindows, parseDateOnly } from "../src/dates.js";
import { evaluateListing } from "../src/filtering.js";
import { AccorSnapshotSource } from "../src/sources/accorSnapshot.js";
import { ApartmentCandidateSnapshotSource } from "../src/sources/apartmentCandidateSnapshot.js";
import { BookingSnapshotSource } from "../src/sources/bookingSnapshot.js";
import { FixtureSource } from "../src/sources/fixture.js";
import { SerpApiGoogleHotelsSource } from "../src/sources/serpapiGoogleHotels.js";
import { WebSearchCliSource } from "../src/sources/websearchCli.js";
import { testConfig } from "./helpers.js";

const cities = [
  {
    name: "Warsaw",
    country: "PL",
    center: [52.2297, 21.0122] as [number, number],
    centralRadiusKm: 4.5,
    acceptedTransitModes: ["metro", "SKM", "KM", "tram"],
    aliases: []
  }
];

const krakowCities = [
  {
    name: "Krakow",
    country: "PL",
    center: [50.0647, 19.945] as [number, number],
    centralRadiusKm: 4,
    acceptedTransitModes: ["tram", "train"],
    aliases: ["Kraków"]
  }
];

const lisbonCities = [
  {
    name: "Lisbon",
    country: "PT",
    center: [38.7223, -9.1393] as [number, number],
    centralRadiusKm: 5,
    acceptedTransitModes: ["metro", "commuter rail", "tram"],
    aliases: []
  }
];

const poznanCities = [
  {
    name: "Poznan",
    country: "PL",
    center: [52.4064, 16.9252] as [number, number],
    centralRadiusKm: 4,
    acceptedTransitModes: ["tram", "commuter rail", "bus"],
    aliases: ["Poznań"]
  }
];

const rzeszowCities = [
  {
    name: "Rzeszow",
    country: "PL",
    center: [50.0413, 21.999] as [number, number],
    centralRadiusKm: 4,
    acceptedTransitModes: ["bus", "train", "commuter rail"],
    aliases: ["Rzeszów"]
  }
];

const sofiaCities = [
  {
    name: "Sofia",
    country: "BG",
    center: [42.6977, 23.3219] as [number, number],
    centralRadiusKm: 5,
    acceptedTransitModes: ["metro", "tram", "bus"],
    aliases: []
  }
];

const budapestCities = [
  {
    name: "Budapest",
    country: "HU",
    center: [47.4979, 19.0402] as [number, number],
    centralRadiusKm: 5,
    acceptedTransitModes: ["metro", "tram", "suburban rail", "bus"],
    aliases: []
  }
];

const bucharestCities = [
  {
    name: "Bucharest",
    country: "RO",
    center: [44.4268, 26.1025] as [number, number],
    centralRadiusKm: 5,
    acceptedTransitModes: ["metro", "tram", "bus", "train"],
    aliases: []
  }
];

test("FixtureSource returns normalized listings with transit evidence", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-04"),
    { startMonthsFromNow: 3, endMonthsFromNow: 3, stepDays: 21 },
    [2, 3]
  );
  const source = new FixtureSource(path.resolve("data/fixture_listings.json"));
  const listings = await source.search(cities, windows);

  assert.equal(listings.length, 1);
  assert.equal(listings[0]?.city, "Warsaw");
  assert.equal(listings[0]?.transit.status, "confirmed");
});

test("SerpApiGoogleHotelsSource returns no listings without key", async () => {
  const source = new SerpApiGoogleHotelsSource("");
  const windows = generateDateWindows(
    parseDateOnly("2026-07-04"),
    { startMonthsFromNow: 3, endMonthsFromNow: 3, stepDays: 21 },
    [2]
  );

  assert.deepEqual(await source.search(cities, windows), []);
});

test("WebSearchCliSource returns no listings without cache or explicit live enablement", async () => {
  const original = process.env.ENABLE_CODEX_WEBSEARCH;
  const originalCache = process.env.WEBSEARCH_CACHE_PATH;
  const temp = await mkdtemp(path.join(os.tmpdir(), "websearch-cache-test-"));
  delete process.env.ENABLE_CODEX_WEBSEARCH;
  process.env.WEBSEARCH_CACHE_PATH = path.join(temp, "missing-cache.json");
  try {
    const source = new WebSearchCliSource();
    const windows = generateDateWindows(
      parseDateOnly("2026-07-04"),
      { startMonthsFromNow: 3, endMonthsFromNow: 3, stepDays: 21 },
      [2]
    );

    assert.deepEqual(await source.search(cities, windows), []);
  } finally {
    await rm(temp, { recursive: true, force: true });
    if (original === undefined) {
      delete process.env.ENABLE_CODEX_WEBSEARCH;
    } else {
      process.env.ENABLE_CODEX_WEBSEARCH = original;
    }
    if (originalCache === undefined) {
      delete process.env.WEBSEARCH_CACHE_PATH;
    } else {
      process.env.WEBSEARCH_CACHE_PATH = originalCache;
    }
  }
});

test("WebSearchCliSource reads cached non-Booking results", async () => {
  const original = process.env.ENABLE_CODEX_WEBSEARCH;
  const originalCache = process.env.WEBSEARCH_CACHE_PATH;
  delete process.env.ENABLE_CODEX_WEBSEARCH;
  delete process.env.WEBSEARCH_CACHE_PATH;
  try {
    const source = new WebSearchCliSource();
    const windows = generateDateWindows(
      parseDateOnly("2026-07-04"),
      { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
      [2, 3, 4, 5, 6]
    );

    const listings = await source.search(bucharestCities, windows);
    assert.ok(listings.some((listing) => listing.source === "websearch_cli"));
    assert.ok(listings.some((listing) => listing.url.includes("hotels.com")));
  } finally {
    if (original === undefined) {
      delete process.env.ENABLE_CODEX_WEBSEARCH;
    } else {
      process.env.ENABLE_CODEX_WEBSEARCH = original;
    }
    if (originalCache === undefined) {
      delete process.env.WEBSEARCH_CACHE_PATH;
    } else {
      process.env.WEBSEARCH_CACHE_PATH = originalCache;
    }
  }
});

test("AccorSnapshotSource returns real snapshot listings for generated windows", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3]
  );
  const source = new AccorSnapshotSource(path.resolve("data/accor_live_snapshot.json"));
  const listings = await source.search(cities, windows);

  assert.equal(listings.length, 2);
  assert.ok(listings.every((listing) => listing.source === "accor_snapshot"));
  assert.ok(listings.every((listing) => !listing.name.toLowerCase().includes("fixture")));
});

test("ApartmentCandidateSnapshotSource returns real apartment-style evidence but does not imply acceptance", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new ApartmentCandidateSnapshotSource(path.resolve("data/apartment_candidate_snapshot.json"));
  const listings = await source.search(krakowCities, windows);

  assert.equal(listings.length, 1);
  assert.equal(listings[0]?.name, "Happy Tower Kraków");
  assert.equal(listings[0]?.source, "apartment_candidate_snapshot");
  assert.equal(listings[0]?.dates.nights, 1);
  assert.equal(listings[0]?.amenities.kitchen_or_kitchenette?.status, "confirmed");
  assert.equal(listings[0]?.amenities.stovetop?.status, "confirmed");
  assert.equal(listings[0]?.amenities.utensils?.status, "confirmed");
  assert.equal(listings[0]?.amenities.blackout_window_covering?.status, "confirmed");

  const result = evaluateListing(listings[0]!, testConfig());
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("outside the configured 2-6 night range")));
});

test("BookingSnapshotSource returns live Booking connector candidates with QA evidence and strict rejection", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(krakowCities, windows);

  assert.equal(listings.length, 2);
  const queenBee = listings.find((listing) => listing.name === "Queen Bee Apartments Krakow Old Town");
  assert.ok(queenBee);
  assert.equal(queenBee.source, "booking_snapshot");
  assert.equal(queenBee.dates.nights, 2);
  assert.equal(queenBee.nightlyPriceEur, 38.875);
  assert.equal(queenBee.amenities.adjustable_climate_control?.status, "confirmed");
  assert.equal(queenBee.amenities.kitchen_or_kitchenette?.status, "confirmed");
  assert.equal(queenBee.amenities.stovetop?.status, "missing");
  assert.equal(queenBee.amenities.blackout_window_covering?.status, "missing");
  assert.ok(Array.isArray(queenBee.raw.qa_evidence));

  const result = evaluateListing(queenBee, testConfig());
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("stovetop is not evidenced")));
  assert.ok(result.reasons.some((reason) => reason.includes("blackout window covering needs manual check")));
});

test("BookingSnapshotSource preserves full-amenity price-fail candidates", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(lisbonCities, windows);

  assert.equal(listings.length, 1);
  const listing = listings[0]!;
  assert.equal(listing.name, "Morgan-Jupiter Apartments");
  assert.equal(listing.nightlyPriceEur, 69.905);
  assert.ok(Object.values(listing.amenities).every((item) => item.status === "confirmed"));

  const result = evaluateListing(listing, testConfig());
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("above the configured maximum")));
});

test("BookingSnapshotSource accepts under-cap candidates with blackout warning", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(poznanCities, windows);

  assert.equal(listings.length, 1);
  const listing = listings[0]!;
  assert.equal(listing.name, "Stay99 Apart");
  assert.equal(listing.nightlyPriceEur, 42.975);
  assert.equal(listing.amenities.adjustable_climate_control?.status, "confirmed");
  assert.equal(listing.amenities.kitchen_or_kitchenette?.status, "confirmed");
  assert.equal(listing.amenities.stovetop?.status, "confirmed");
  assert.equal(listing.amenities.utensils?.status, "confirmed");
  assert.equal(listing.amenities.blackout_window_covering?.status, "missing");

  const result = evaluateListing(listing, testConfig());
  assert.equal(result.accepted, true);
  assert.ok(result.reasons.some((reason) => reason.includes("blackout window covering needs manual check")));
  assert.ok(result.manualVerification.some((item) => item.includes("Check blackout window covering")));
});

test("BookingSnapshotSource preserves Rzeszow blackout warning even when value score rejects", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(rzeszowCities, windows);

  assert.equal(listings.length, 1);
  const listing = listings[0]!;
  assert.equal(listing.name, "IK Apartamenty");
  assert.equal(listing.nightlyPriceEur, 45.61);
  assert.equal(listing.amenities.kitchen_or_kitchenette?.status, "confirmed");
  assert.equal(listing.amenities.stovetop?.status, "confirmed");
  assert.equal(listing.amenities.utensils?.status, "confirmed");
  assert.equal(listing.amenities.blackout_window_covering?.status, "missing");

  const result = evaluateListing(listing, testConfig());
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("blackout window covering needs manual check")));
  assert.ok(result.reasons.some((reason) => reason.includes("value score is not strong enough")));
  assert.ok(result.manualVerification.some((item) => item.includes("Check blackout window covering")));
});

test("BookingSnapshotSource preserves Sofia blackout warning even when value score rejects", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(sofiaCities, windows);

  assert.equal(listings.length, 2);
  assert.ok(listings.every((listing) => listing.nightlyPriceEur <= 50));
  assert.ok(listings.every((listing) => listing.amenities.kitchen_or_kitchenette?.status === "confirmed"));
  assert.ok(listings.every((listing) => listing.amenities.stovetop?.status === "confirmed"));
  assert.ok(listings.every((listing) => listing.amenities.utensils?.status === "confirmed"));
  assert.ok(listings.every((listing) => listing.amenities.blackout_window_covering?.status === "missing"));

  const results = listings.map((listing) => evaluateListing(listing, testConfig()));
  assert.ok(results.every((result) => result.accepted === false));
  assert.ok(results.every((result) => result.reasons.some((reason) => reason.includes("blackout window covering needs manual check"))));
  assert.ok(results.every((result) => result.reasons.some((reason) => reason.includes("value score is not strong enough"))));
  assert.ok(results.every((result) => result.manualVerification.some((item) => item.includes("Check blackout window covering"))));
});

test("BookingSnapshotSource preserves Budapest under-cap candidate with ambiguous blackout evidence", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(budapestCities, windows);

  assert.equal(listings.length, 1);
  const listing = listings[0]!;
  assert.equal(listing.name, "LH Gallery Apartments");
  assert.equal(listing.nightlyPriceEur, 48.605);
  assert.equal(listing.amenities.kitchen_or_kitchenette?.status, "confirmed");
  assert.equal(listing.amenities.stovetop?.status, "confirmed");
  assert.equal(listing.amenities.utensils?.status, "confirmed");
  assert.equal(listing.amenities.blackout_window_covering?.status, "ambiguous");

  const result = evaluateListing(listing, testConfig());
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("blackout window covering is ambiguous")));
  assert.ok(result.reasons.some((reason) => reason.includes("value score is not strong enough")));
  assert.ok(result.manualVerification.some((item) => item.includes("Check blackout window covering")));
});

test("BookingSnapshotSource accepts fully evidenced Bucharest under-cap apartment", async () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-05"),
    { startMonthsFromNow: 0, endMonthsFromNow: 6, stepDays: 21 },
    [2, 3, 4, 5, 6]
  );
  const source = new BookingSnapshotSource(path.resolve("data/booking_live_snapshot.json"));
  const listings = await source.search(bucharestCities, windows);

  assert.equal(listings.length, 1);
  const listing = listings[0]!;
  assert.equal(listing.name, "Little Bucharest downtown apartments Romana");
  assert.equal(listing.nightlyPriceEur, 46.53);
  assert.equal(listing.amenities.adjustable_climate_control?.status, "confirmed");
  assert.equal(listing.amenities.kitchen_or_kitchenette?.status, "confirmed");
  assert.equal(listing.amenities.stovetop?.status, "confirmed");
  assert.equal(listing.amenities.utensils?.status, "confirmed");
  assert.equal(listing.amenities.blackout_window_covering?.status, "confirmed");

  const result = evaluateListing(listing, testConfig());
  assert.equal(result.accepted, true);
});
