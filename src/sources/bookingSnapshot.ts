import { readFile } from "node:fs/promises";
import type { CityConfig, Evidence, Listing } from "../models.js";
import type { DateWindow } from "../models.js";
import type { SourceAdapter } from "./base.js";

interface SnapshotFile {
  fetched_at: string;
  source_tool: string;
  pricing_note: string;
  listings: SnapshotListing[];
}

interface SnapshotListing {
  source_listing_id: string;
  booking_hotel_id: number;
  name: string;
  url: string;
  city: string;
  neighborhood: string;
  location_text: string;
  latitude?: number;
  longitude?: number;
  room_type: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_price_eur: number;
  nightly_price_eur: number;
  rating: number | null;
  rating_scale: number;
  review_count: number | null;
  cancellation_policy: string;
  source_reliability: number;
  amenities: Record<string, Omit<Evidence, "source">>;
  transit: Evidence;
  evidence_urls?: string[];
  qa_evidence?: string[];
  [key: string]: unknown;
}

export class BookingSnapshotSource implements SourceAdapter {
  readonly name = "booking_snapshot";

  constructor(private readonly path: string) {}

  async search(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]> {
    const data = JSON.parse(await readFile(this.path, "utf8")) as SnapshotFile;
    const cityNames = new Set(cities.map((city) => city.name.toLowerCase()));
    const allowedNights = new Set(windows.map((window) => window.nights));
    const sortedCheckIns = windows.map((window) => window.checkIn).sort();
    const minCheckIn = sortedCheckIns[0] ?? "0000-00-00";
    const maxCheckIn = sortedCheckIns.at(-1) ?? "9999-99-99";

    return data.listings
      .filter((item) => cityNames.has(item.city.toLowerCase()))
      .filter((item) => allowedNights.has(item.nights))
      .filter((item) => item.check_in >= minCheckIn && item.check_in <= maxCheckIn)
      .map((item) => this.normalize(item, data));
  }

  private normalize(item: SnapshotListing, data: SnapshotFile): Listing {
    const amenities: Record<string, Evidence> = {};
    for (const [key, value] of Object.entries(item.amenities)) {
      amenities[key] = { ...value, source: this.name };
    }

    return {
      source: this.name,
      sourceReliability: item.source_reliability,
      sourceListingId: item.source_listing_id,
      name: item.name,
      url: item.url,
      city: item.city,
      neighborhood: item.neighborhood,
      dates: {
        checkIn: item.check_in,
        checkOut: item.check_out,
        nights: item.nights,
        label: `${item.check_in} to ${item.check_out}`
      },
      totalPriceEur: item.total_price_eur,
      nightlyPriceEur: item.nightly_price_eur,
      rating: item.rating,
      ratingScale: item.rating_scale,
      reviewCount: item.review_count,
      locationText: item.location_text,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      roomType: item.room_type,
      cancellationPolicy: item.cancellation_policy,
      amenities,
      transit: item.transit,
      raw: {
        ...item,
        fetched_at: data.fetched_at,
        source_tool: data.source_tool,
        pricing_note: data.pricing_note,
        evidence_urls: item.evidence_urls ?? [],
        qa_evidence: item.qa_evidence ?? []
      }
    };
  }
}
