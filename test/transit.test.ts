import assert from "node:assert/strict";
import test from "node:test";
import { estimateTransitAccessibility, haversineKm } from "../src/transit.js";
import { testListing } from "./helpers.js";

test("haversineKm returns central distance in a plausible range", () => {
  const distance = haversineKm([52.2297, 21.0122], [52.247, 20.998]);
  assert.ok(distance > 1);
  assert.ok(distance < 3);
});

test("estimateTransitAccessibility confirms central coordinates", () => {
  const evidence = estimateTransitAccessibility(testListing(), {
    name: "Warsaw",
    country: "PL",
    center: [52.2297, 21.0122],
    centralRadiusKm: 4.5,
    acceptedTransitModes: ["metro", "SKM", "KM", "tram"],
    aliases: []
  });

  assert.equal(evidence.status, "confirmed");
  assert.equal(evidence.source, "coordinates");
});

test("estimateTransitAccessibility infers transit from station text", () => {
  const listing = testListing({ latitude: null, longitude: null, locationText: "Near main station" });
  const evidence = estimateTransitAccessibility(listing, {
    name: "Test City",
    country: "TC",
    centralRadiusKm: 1,
    acceptedTransitModes: ["metro"],
    aliases: []
  });

  assert.equal(evidence.status, "inferred");
});
