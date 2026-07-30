import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { evaluateListing } from "../src/filtering.js";
import { formatAcceptedDealsForConsole, resultToDict, writeJsonReport, writeMarkdownReport } from "../src/report.js";
import { evidence, testConfig, testListing } from "./helpers.js";

test("resultToDict exposes required report fields", () => {
  const result = evaluateListing(testListing(), testConfig());
  const data = resultToDict(result);

  for (const key of [
    "city",
    "neighborhood",
    "source",
    "listing_name",
    "url",
    "dates_tested",
    "stay_length",
    "total_price_eur",
    "nightly_equivalent_eur",
    "rating",
    "review_count",
    "amenity_evidence",
    "transit_accessibility_evidence",
    "confidence_score",
    "value_score",
    "source_metadata",
    "why",
    "manual_verification"
  ]) {
    assert.ok(key in data, key);
  }
});

test("report writers create markdown and json files", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "travel-report-"));
  try {
    const result = evaluateListing(testListing(), testConfig());
    await writeJsonReport([result], path.join(temp, "travel-deals.json"));
    await writeMarkdownReport([result], path.join(temp, "travel-deals.md"));

    const json = JSON.parse(await readFile(path.join(temp, "travel-deals.json"), "utf8")) as unknown[];
    const markdown = await readFile(path.join(temp, "travel-deals.md"), "utf8");
    assert.equal(json.length, 1);
    assert.match(markdown, /Travel Deal Candidates/);
    assert.match(markdown, /Accepted candidates: 1/);
    assert.match(markdown, /Manual verification before booking/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("formatAcceptedDealsForConsole prints only accepted deals", () => {
  const accepted = evaluateListing(testListing({ name: "Accepted Apartment" }), testConfig());
  const rejected = evaluateListing(
    testListing({
      name: "Rejected Apartment",
      nightlyPriceEur: 75,
      totalPriceEur: 150
    }),
    testConfig()
  );

  assert.equal(accepted.accepted, true);
  assert.equal(rejected.accepted, false);

  const output = formatAcceptedDealsForConsole([accepted, rejected]);
  assert.match(output, /Accepted deals: 1/);
  assert.match(output, /Accepted Apartment/);
  assert.doesNotMatch(output, /Rejected Apartment/);
});

test("formatAcceptedDealsForConsole warns in yellow when accepted deal needs blackout check", () => {
  const listing = testListing({ name: "Manual Blackout Apartment" });
  listing.amenities.blackout_window_covering = evidence("missing", "Blackout curtains are not listed.");
  const accepted = evaluateListing(listing, testConfig());

  assert.equal(accepted.accepted, true);

  const output = formatAcceptedDealsForConsole([accepted]);
  assert.match(output, /\u001b\[33m\s+WARNING: blackout needs manual check/);
  assert.match(output, /Blackout curtains are not listed/);
  assert.match(output, /\u001b\[0m/);
});
