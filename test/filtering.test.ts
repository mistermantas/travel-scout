import assert from "node:assert/strict";
import test from "node:test";
import { evaluateListing } from "../src/filtering.js";
import { evidence, testConfig, testListing, testWindow } from "./helpers.js";

test("rejects shared room when config disallows it", () => {
  const result = evaluateListing(testListing({ roomType: "bed in shared dorm" }), testConfig());

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("dorm/shared-room")));
});

test("ambiguous required amenity is rejected until directly confirmed", () => {
  const listing = testListing();
  listing.amenities.adjustable_climate_control = evidence("ambiguous", "AC, control unclear");
  const result = evaluateListing(listing, testConfig());

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("adjustable climate control is ambiguous")));
  assert.ok(result.manualVerification.some((item) => item.includes("Verify adjustable climate control")));
});

test("blackout evidence is a manual warning, not a hard rejection", () => {
  const listing = testListing();
  listing.amenities.blackout_window_covering = evidence("missing", "Blackout curtains are not listed.");
  const result = evaluateListing(listing, testConfig());

  assert.equal(result.accepted, true);
  assert.ok(result.reasons.some((reason) => reason.includes("blackout window covering needs manual check")));
  assert.ok(result.manualVerification.some((item) => item.includes("Check blackout window covering")));
});

test("ambiguous blackout evidence is a manual warning, not a hard rejection", () => {
  const listing = testListing();
  listing.amenities.blackout_window_covering = evidence("ambiguous", "Reviews mention nearly blackout shades.");
  const result = evaluateListing(listing, testConfig());

  assert.equal(result.accepted, true);
  assert.ok(result.reasons.some((reason) => reason.includes("blackout window covering is ambiguous")));
  assert.ok(result.manualVerification.some((item) => item.includes("Check blackout window covering")));
});

test("over preferred price requires strong value score", () => {
  const listing = testListing({
    nightlyPriceEur: 49,
    totalPriceEur: 147,
    rating: 8,
    reviewCount: 5,
    sourceReliability: 0.35
  });
  const result = evaluateListing(listing, testConfig());

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("value score is not strong enough")));
});

test("expanded price band listings are allowed with a warning", () => {
  const config = {
    ...testConfig(),
    maxNightlyPriceEur: 80,
    pricePenaltyThresholdEur: 50
  };
  const listing = testListing({
    nightlyPriceEur: 70,
    totalPriceEur: 140,
    rating: 8.4,
    reviewCount: 100,
    sourceReliability: 0.8
  });
  const result = evaluateListing(listing, config);

  assert.equal(result.accepted, true);
  assert.ok(result.reasons.some((reason) => reason.includes("expanded EUR 50-80 band")));
});

test("rejects stays outside configured short-stay range", () => {
  const result = evaluateListing(testListing({ dates: testWindow(1), totalPriceEur: 32 }), testConfig());

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes("outside the configured 2-6 night range")));
});

test("allows unclear total pricing as preliminary discovery evidence", () => {
  const result = evaluateListing(testListing({ raw: { fees_unclear: true } }), testConfig());

  assert.equal(result.accepted, true);
  assert.ok(result.reasons.some((reason) => reason.includes("Displayed price is preliminary")));
  assert.ok(result.manualVerification.some((item) => item.includes("Verify whether taxes")));
});

test("allows tax-excluded pricing as preliminary discovery evidence", () => {
  const result = evaluateListing(testListing({ raw: { pricing_context: { tax: "TAXES_EXCLUDED" } } }), testConfig());

  assert.equal(result.accepted, true);
  assert.ok(result.reasons.some((reason) => reason.includes("excludes taxes or mandatory fees")));
  assert.ok(result.manualVerification.some((item) => item.includes("Verify whether taxes")));
});
