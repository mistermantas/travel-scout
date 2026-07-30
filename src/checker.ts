import path from "node:path";
import type { AppConfig } from "./config.js";
import { generateDateWindows } from "./dates.js";
import { evaluateListing } from "./filtering.js";
import { stableListingKey, type DealResult } from "./models.js";
import { writeJsonReport, writeMarkdownReport } from "./report.js";
import { AccorSnapshotSource } from "./sources/accorSnapshot.js";
import { ApartmentCandidateSnapshotSource } from "./sources/apartmentCandidateSnapshot.js";
import type { SourceAdapter } from "./sources/base.js";
import { BookingSnapshotSource } from "./sources/bookingSnapshot.js";
import { FixtureSource } from "./sources/fixture.js";
import { SerpApiGoogleHotelsSource } from "./sources/serpapiGoogleHotels.js";
import { WebSearchCliSource, type WebSearchCliOptions } from "./sources/websearchCli.js";
import { SeenStore } from "./store.js";

export interface SourcePaths {
  fixture: string;
  accorSnapshot: string;
  apartmentCandidate: string;
  bookingSnapshot: string;
}

export interface SourceRun {
  name: string;
  status: "ok" | "empty" | "error";
  candidateCount: number;
  acceptedCount: number;
  error?: string;
}

export interface CheckSummary {
  candidates: number;
  accepted: number;
  excluded: number;
  newAccepted: number;
  windowCount: number;
  cityCount: number;
}

export interface CheckRun {
  results: DealResult[];
  summary: CheckSummary;
  sources: SourceRun[];
  generatedAt: string;
}

export interface CheckOptions {
  today?: Date;
  rootDir?: string;
  outDir?: string;
  writeReports?: boolean;
  writeState?: boolean;
  sourcePaths?: Partial<SourcePaths>;
  webSearch?: WebSearchCliOptions;
}

export async function runChecker(config: AppConfig, options: CheckOptions = {}): Promise<CheckRun> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const today = options.today ?? new Date();
  const windows = generateDateWindows(today, config.dateHorizon, config.stayLengths);
  const excluded = new Set(config.excludedCities.map((city) => city.toLowerCase()));
  const includedCities = config.cities.filter((city) => !excluded.has(city.name.toLowerCase()));
  const sources = createSources(config.sourcesEnabled, resolveSourcePaths(rootDir, options.sourcePaths), options.webSearch);

  const store = new SeenStore(config.statePath);
  await store.load();

  const settled = await Promise.allSettled(sources.map((source) => source.search(includedCities, windows)));
  const sourceRuns: SourceRun[] = [];
  const rawListings = settled.flatMap((result, index) => {
    const source = sources[index];
    if (result.status === "rejected") {
      sourceRuns.push({
        name: source.name,
        status: "error",
        candidateCount: 0,
        acceptedCount: 0,
        error: errorMessage(result.reason)
      });
      return [];
    }
    sourceRuns.push({
      name: source.name,
      status: result.value.length ? "ok" : "empty",
      candidateCount: result.value.length,
      acceptedCount: 0
    });
    return result.value;
  });

  const results = rawListings
    .map((listing) => evaluateListing(listing, config, store.isNew(stableListingKey(listing))))
    .sort((first, second) => {
      if (Number(first.accepted) !== Number(second.accepted)) {
        return Number(second.accepted) - Number(first.accepted);
      }
      if (second.score.total !== first.score.total) return second.score.total - first.score.total;
      return second.score.confidence - first.score.confidence;
    })
    .slice(0, config.reportTopN);

  for (const sourceRun of sourceRuns) {
    sourceRun.acceptedCount = results.filter(
      (result) => result.accepted && result.listing.source === sourceRun.name
    ).length;
  }

  if (options.writeReports ?? true) {
    const outDir = path.resolve(rootDir, options.outDir ?? "reports");
    await writeJsonReport(results, path.join(outDir, "travel-deals.json"));
    await writeMarkdownReport(results, path.join(outDir, "travel-deals.md"));
  }

  if (options.writeState ?? false) {
    await store.markMany(results.filter((result) => result.accepted).map((result) => stableListingKey(result.listing)));
  }

  const accepted = results.filter((result) => result.accepted);
  return {
    results,
    sources: sourceRuns,
    generatedAt: new Date().toISOString(),
    summary: {
      candidates: results.length,
      accepted: accepted.length,
      excluded: results.length - accepted.length,
      newAccepted: accepted.filter((result) => result.isNew).length,
      windowCount: windows.length,
      cityCount: includedCities.length
    }
  };
}

export function createSources(
  enabled: string[],
  paths: SourcePaths,
  webSearch?: WebSearchCliOptions
): SourceAdapter[] {
  const sources: SourceAdapter[] = [];
  if (enabled.includes("fixture")) sources.push(new FixtureSource(paths.fixture));
  if (enabled.includes("accor_snapshot")) sources.push(new AccorSnapshotSource(paths.accorSnapshot));
  if (enabled.includes("apartment_candidate_snapshot")) {
    sources.push(new ApartmentCandidateSnapshotSource(paths.apartmentCandidate));
  }
  if (enabled.includes("booking_snapshot")) sources.push(new BookingSnapshotSource(paths.bookingSnapshot));
  if (enabled.includes("websearch_cli")) sources.push(new WebSearchCliSource(webSearch));
  if (enabled.includes("serpapi_google_hotels")) sources.push(new SerpApiGoogleHotelsSource());
  return sources;
}

function resolveSourcePaths(rootDir: string, overrides: Partial<SourcePaths> = {}): SourcePaths {
  return {
    fixture: path.resolve(rootDir, overrides.fixture ?? "data/fixture_listings.json"),
    accorSnapshot: path.resolve(rootDir, overrides.accorSnapshot ?? "data/accor_live_snapshot.json"),
    apartmentCandidate: path.resolve(rootDir, overrides.apartmentCandidate ?? "data/apartment_candidate_snapshot.json"),
    bookingSnapshot: path.resolve(rootDir, overrides.bookingSnapshot ?? "data/booking_live_snapshot.json")
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
