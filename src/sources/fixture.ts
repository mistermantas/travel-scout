import { readFile } from "node:fs/promises";
import type { CityConfig, DateWindow, Evidence, Listing } from "../models.js";
import { estimateTransitAccessibility } from "../transit.js";
import type { SourceAdapter } from "./base.js";

interface FixtureAmenity {
  status: Evidence["status"];
  detail: string;
}

interface FixtureListing {
  source_listing_id: string;
  name: string;
  url: string;
  city: string;
  neighborhood?: string;
  location_text?: string;
  latitude?: number;
  longitude?: number;
  room_type?: string;
  nightly_price_eur: number;
  available_stay_lengths: number[];
  rating?: number;
  rating_scale?: number;
  review_count?: number;
  cancellation_policy?: string;
  source_reliability?: number;
  amenities?: Record<string, FixtureAmenity>;
  [key: string]: unknown;
}

interface FixtureFile {
  listings: FixtureListing[];
}

export class FixtureSource implements SourceAdapter {
  readonly name = "fixture";

  constructor(private readonly path: string) {}

  async search(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]> {
    const data = JSON.parse(await readFile(this.path, "utf8")) as FixtureFile;
    const cityByName = new Map(cities.map((city) => [city.name.toLowerCase(), city]));
    const listings: Listing[] = [];

    for (const item of data.listings) {
      const city = cityByName.get(item.city.toLowerCase());
      if (!city) continue;
      const window = windows.find((candidate) => item.available_stay_lengths.includes(candidate.nights));
      if (!window) continue;
      const listing = this.listingFromItem(item, window);
      listing.transit = estimateTransitAccessibility(listing, city);
      listings.push(listing);
    }

    return listings;
  }

  private listingFromItem(item: FixtureListing, window: DateWindow): Listing {
    const amenities: Record<string, Evidence> = {};
    for (const [key, value] of Object.entries(item.amenities ?? {})) {
      amenities[key] = { status: value.status, detail: value.detail, source: this.name };
    }
    const nightly = Number(item.nightly_price_eur);
    return {
      source: this.name,
      sourceReliability: Number(item.source_reliability ?? 0.6),
      sourceListingId: String(item.source_listing_id),
      name: item.name,
      url: item.url,
      city: item.city,
      neighborhood: item.neighborhood ?? "",
      dates: window,
      totalPriceEur: round(nightly * window.nights, 2),
      nightlyPriceEur: nightly,
      rating: item.rating ?? null,
      ratingScale: Number(item.rating_scale ?? 10),
      reviewCount: item.review_count ?? null,
      locationText: item.location_text ?? "",
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      roomType: item.room_type ?? "",
      cancellationPolicy: item.cancellation_policy ?? "",
      amenities,
      transit: { status: "missing", detail: "No transit evidence." },
      raw: item
    };
  }
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
