import defaultConfigJson from "../config.example.json";
import cachedDealsJson from "../reports/travel-deals.json";
import type { BootstrapPayload, Deal, SourceCatalogItem, SourceRun, TravelConfig } from "./types";

export const defaultConfig = defaultConfigJson as TravelConfig;
export const cachedDeals = cachedDealsJson as Deal[];

export const sourceCatalog: SourceCatalogItem[] = [
  { id: "booking_snapshot", label: "Booking", kind: "snapshot" },
  { id: "websearch_cli", label: "Web search", kind: "cache + live" },
  { id: "apartment_candidate_snapshot", label: "Hotels / Expedia", kind: "snapshot" },
  { id: "accor_snapshot", label: "Accor", kind: "snapshot" },
  { id: "serpapi_google_hotels", label: "Google Hotels", kind: "API key" },
  { id: "fixture", label: "Fixture", kind: "demo" }
];

export function createFallbackBootstrap(config: TravelConfig = defaultConfig): BootstrapPayload {
  const results = cachedDeals.slice(0, config.report_top_n);
  const accepted = results.filter((deal) => deal.accepted);
  return {
    config,
    default_config: defaultConfig,
    using_local_config: false,
    source_catalog: sourceCatalog,
    check: {
      generated_at: newestFetchedDate(results),
      summary: {
        candidates: results.length,
        accepted: accepted.length,
        excluded: results.length - accepted.length,
        newAccepted: accepted.filter((deal) => deal.is_new).length,
        windowCount: 0,
        cityCount: new Set(results.map((deal) => deal.city)).size
      },
      sources: buildSourceRuns(results),
      results
    }
  };
}

function buildSourceRuns(results: Deal[]): SourceRun[] {
  return sourceCatalog
    .filter((source) => results.some((deal) => deal.source === source.id))
    .map((source) => {
      const matching = results.filter((deal) => deal.source === source.id);
      return {
        name: source.id,
        status: "ok",
        candidateCount: matching.length,
        acceptedCount: matching.filter((deal) => deal.accepted).length
      };
    });
}

function newestFetchedDate(results: Deal[]): string {
  const dates = results
    .map((deal) => deal.source_metadata.fetched_at)
    .filter((date): date is string => Boolean(date))
    .sort();
  return dates.at(-1) ?? new Date(0).toISOString();
}
