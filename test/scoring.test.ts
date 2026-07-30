import assert from "node:assert/strict";
import test from "node:test";
import { priceScore, scoreListing } from "../src/scoring.js";
import { evidence, testConfig, testListing } from "./helpers.js";

test("priceScore strongly favors under preferred price", () => {
  assert.equal(priceScore(30, 35, 50), 1);
  assert.equal(priceScore(50, 35, 50), 0);
  assert.ok(priceScore(42, 35, 50) > 0);
  assert.ok(priceScore(42, 35, 50) < 1);
});

test("missing required amenity reduces value score and confidence", () => {
  const config = testConfig();
  const strong = scoreListing(testListing(), config);
  const weakListing = testListing();
  weakListing.amenities.stovetop = evidence("missing", "No stovetop");
  const weak = scoreListing(weakListing, config);

  assert.ok(strong.total > weak.total);
  assert.ok(strong.confidence > weak.confidence);
  assert.ok(weak.amenityUncertaintyPenalty > 0);
});

test("unclear fees add explicit penalty", () => {
  const config = testConfig();
  const clear = scoreListing(testListing(), config);
  const unclear = scoreListing(testListing({ raw: { fees_unclear: true } }), config);

  assert.ok(unclear.unclearFeePenalty > 0);
  assert.ok(clear.total > unclear.total);
});

test("expanded price band adds risk penalty", () => {
  const config = {
    ...testConfig(),
    maxNightlyPriceEur: 80,
    pricePenaltyThresholdEur: 50
  };
  const underThreshold = scoreListing(testListing({ nightlyPriceEur: 49, totalPriceEur: 98 }), config);
  const expandedBand = scoreListing(testListing({ nightlyPriceEur: 70, totalPriceEur: 140 }), config);

  assert.ok(expandedBand.riskPenalty > underThreshold.riskPenalty);
  assert.ok(underThreshold.total > expandedBand.total);
});
