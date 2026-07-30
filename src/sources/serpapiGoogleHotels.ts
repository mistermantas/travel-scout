import { randomUUID } from "node:crypto";
import type { CityConfig, DateWindow, Evidence, Listing } from "../models.js";
import { estimateTransitAccessibility } from "../transit.js";
import type { SourceAdapter } from "./base.js";

interface SerpApiHotelItem {
  name?: string;
  property_token?: string;
  link?: string;
  serpapi_property_details_link?: string;
  neighborhood?: string;
  type?: string;
  description?: string;
  location_rating?: string;
  overall_rating?: number;
  reviews?: number;
  amenities?: string[];
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  rate_per_night?: RateValue;
  total_rate?: RateValue;
  [key: string]: unknown;
}

type RateValue =
  | number
  | {
      extracted_lowest?: number;
      extracted_before_taxes_fees?: number;
      [key: string]: unknown;
    };

interface SerpApiResponse {
  properties?: SerpApiHotelItem[];
  error?: string;
}

export class SerpApiGoogleHotelsSource implements SourceAdapter {
  readonly name = "serpapi_google_hotels";

  constructor(
    private readonly apiKey = process.env.SERPAPI_API_KEY,
    private readonly maxPerSearch = 15
  ) {}

  async search(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]> {
    if (!this.apiKey) return [];

    const listings: Listing[] = [];
    for (const city of cities) {
      for (const window of windows) {
        const payload = await this.fetch(city, window);
        for (const item of (payload.properties ?? []).slice(0, this.maxPerSearch)) {
          const listing = this.normalize(item, city, window);
          if (listing) {
            listing.transit = estimateTransitAccessibility(listing, city);
            listings.push(listing);
          }
        }
      }
    }
    return listings;
  }

  private async fetch(city: CityConfig, window: DateWindow): Promise<SerpApiResponse> {
    const params = new URLSearchParams({
      engine: "google_hotels",
      q: `aparthotel apartment hotel ${city.name}`,
      check_in_date: window.checkIn,
      check_out_date: window.checkOut,
      adults: "1",
      currency: "EUR",
      gl: city.country.toLowerCase() || "us",
      hl: "en",
      api_key: this.apiKey ?? ""
    });
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as SerpApiResponse;
  }

  private normalize(item: SerpApiHotelItem, city: CityConfig, window: DateWindow): Listing | null {
    const rate = item.rate_per_night ?? item.total_rate;
    const extracted = extractRate(rate);
    if (!extracted) return null;

    const totalRate = extractRate(item.total_rate);
    const feesUnclear = totalRate === null;
    const totalPrice = totalRate ?? extracted * window.nights;
    const nightly = totalPrice / window.nights;
    const amenitiesText = (item.amenities ?? []).join(" ").toLowerCase();
    const kitchenStatus: Evidence["status"] =
      amenitiesText.includes("kitchen") || amenitiesText.includes("kitchenette") ? "confirmed" : "missing";
    const airStatus: Evidence["status"] =
      amenitiesText.includes("air conditioning") || amenitiesText.includes("climate") ? "ambiguous" : "missing";
    const amenities: Record<string, Evidence> = {
      adjustable_climate_control: {
        status: airStatus,
        detail: "Google Hotels may show air conditioning, but individual adjustability usually needs manual confirmation.",
        source: this.name
      },
      kitchen_or_kitchenette: {
        status: kitchenStatus,
        detail: "Amenity text was checked for kitchen/kitchenette.",
        source: this.name
      },
      stovetop: {
        status: "ambiguous",
        detail: "Search result amenities rarely distinguish a stovetop.",
        source: this.name
      },
      utensils: {
        status: "ambiguous",
        detail: "Kitchen inventory is not reliably exposed by Google Hotels search data.",
        source: this.name
      },
      blackout_window_covering: {
        status: "ambiguous",
        detail: "Blackout curtains/shutters are rarely exposed by Google Hotels search data.",
        source: this.name
      }
    };

    return {
      source: this.name,
      sourceReliability: 0.72,
      sourceListingId: String(item.property_token ?? item.name ?? randomUUID()),
      name: item.name ?? "Unnamed property",
      url: item.link ?? item.serpapi_property_details_link ?? "",
      city: city.name,
      neighborhood: item.neighborhood ?? "",
      dates: window,
      totalPriceEur: round(totalPrice, 2),
      nightlyPriceEur: round(nightly, 2),
      rating: item.overall_rating ?? null,
      ratingScale: 5,
      reviewCount: item.reviews ?? null,
      locationText: item.location_rating ?? item.description ?? "",
      latitude: item.gps_coordinates?.latitude ?? null,
      longitude: item.gps_coordinates?.longitude ?? null,
      roomType: item.type ?? "",
      cancellationPolicy: "",
      amenities,
      transit: { status: "missing", detail: "No transit evidence." },
      raw: { ...item, fees_unclear: feesUnclear }
    };
  }
}

function extractRate(rate: RateValue | undefined): number | null {
  if (typeof rate === "number") return rate;
  if (!rate) return null;
  return rate.extracted_lowest ?? rate.extracted_before_taxes_fees ?? null;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
