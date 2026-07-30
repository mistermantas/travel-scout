import assert from "node:assert/strict";
import test from "node:test";
import { createSources, runChecker } from "../src/checker.js";
import { testConfig } from "./helpers.js";

test("createSources only creates configured adapters", () => {
  const sources = createSources(
    ["fixture", "websearch_cli"],
    {
      fixture: "/tmp/fixture.json",
      accorSnapshot: "/tmp/accor.json",
      apartmentCandidate: "/tmp/apartment.json",
      bookingSnapshot: "/tmp/booking.json"
    },
    { live: false, cachePath: "/tmp/websearch.json" }
  );

  assert.deepEqual(sources.map((source) => source.name), ["fixture", "websearch_cli"]);
});

test("runChecker isolates a failed source and returns source diagnostics", async () => {
  const config = {
    ...testConfig(),
    sourcesEnabled: ["fixture", "websearch_cli"]
  };
  const check = await runChecker(config, {
    rootDir: "/tmp/travel-scout-does-not-exist",
    writeReports: false,
    writeState: false,
    webSearch: {
      live: false,
      cachePath: "/tmp/travel-scout-missing-websearch.json"
    }
  });

  assert.equal(check.results.length, 0);
  assert.deepEqual(
    check.sources.map((source) => [source.name, source.status]),
    [
      ["fixture", "error"],
      ["websearch_cli", "empty"]
    ]
  );
});
