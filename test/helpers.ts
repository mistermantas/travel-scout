import type { AppConfig } from "../src/config.js";
import type { DateWindow, Evidence, Listing } from "../src/models.js";

export function testConfig(): AppConfig {
  return {
    cities: [],
    excludedCities: ["Vilnius"],
    maxNightlyPriceEur: 50,
    preferredNightlyPriceEur: 35,
    pricePenaltyThresholdEur: 50,
    stayLengths: [2, 3, 4, 5, 6],
    dateHorizon: {
      startMonthsFromNow: 3,
      endMonthsFromNow: 9,
      stepDays: 21
    },
    minimumRating: {
      tenPoint: 8,
      fivePoint: 4.5
    },
    minimumReviewCount: 25,
    requiredAmenities: ["adjustable_climate_control", "kitchen_or_kitchenette", "stovetop", "utensils", "blackout_window_covering"],
    manualCheckAmenities: ["blackout_window_covering"],
    acceptableTransit: {
      minConfidence: 0.55,
      reasonableCommuteMinutes: 35
    },
    sourcesEnabled: ["fixture"],
    allowSharedRooms: false,
    minValueScoreForOverPreferredPrice: 70,
    reportTopN: 20,
    statePath: "data/seen_results.json"
  };
}

export function testWindow(nights = 3): DateWindow {
  return {
    checkIn: "2026-10-04",
    checkOut: nights === 3 ? "2026-10-07" : "2026-10-06",
    nights,
    label: nights === 3 ? "2026-10-04 to 2026-10-07" : "2026-10-04 to 2026-10-06"
  };
}

export function evidence(status: Evidence["status"], detail = "test evidence"): Evidence {
  return { status, detail, source: "test" };
}

export function testListing(overrides: Partial<Listing> = {}): Listing {
  const nightly = overrides.nightlyPriceEur ?? 32;
  const nights = overrides.dates?.nights ?? 3;
  return {
    source: "fixture",
    sourceReliability: 0.62,
    sourceListingId: "test-listing",
    name: "Test private studio",
    url: "https://example.com/test",
    city: "Warsaw",
    neighborhood: "Central",
    dates: testWindow(nights),
    totalPriceEur: nightly * nights,
    nightlyPriceEur: nightly,
    rating: 8.7,
    ratingScale: 10,
    reviewCount: 80,
    locationText: "Central area near metro",
    latitude: 52.23,
    longitude: 21.01,
    roomType: "private studio",
    cancellationPolicy: "Free cancellation",
    amenities: {
      adjustable_climate_control: evidence("confirmed", "Individual AC"),
      kitchen_or_kitchenette: evidence("confirmed", "Kitchenette"),
      stovetop: evidence("confirmed", "Stovetop"),
      utensils: evidence("confirmed", "Utensils"),
      blackout_window_covering: evidence("confirmed", "Blackout curtains")
    },
    transit: evidence("confirmed", "Central"),
    raw: {},
    ...overrides
  };
}
