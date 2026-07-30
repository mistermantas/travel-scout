export type EvidenceStatus = "confirmed" | "inferred" | "ambiguous" | "missing";

export interface Evidence {
  status: EvidenceStatus;
  detail: string;
  source?: string;
}

export interface CityConfig {
  name: string;
  country: string;
  center?: [number, number];
  centralRadiusKm: number;
  acceptedTransitModes: string[];
  aliases: string[];
}

export interface DateWindow {
  checkIn: string;
  checkOut: string;
  nights: number;
  label: string;
}

export interface Listing {
  source: string;
  sourceReliability: number;
  sourceListingId: string;
  name: string;
  url: string;
  city: string;
  neighborhood: string;
  dates: DateWindow;
  totalPriceEur: number;
  nightlyPriceEur: number;
  rating: number | null;
  ratingScale: number;
  reviewCount: number | null;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  roomType: string;
  cancellationPolicy: string;
  amenities: Record<string, Evidence>;
  transit: Evidence;
  raw: Record<string, unknown>;
}

export interface ScoreBreakdown {
  price: number;
  rating: number;
  reviewConfidence: number;
  amenityMatch: number;
  transit: number;
  stayLength: number;
  cancellation: number;
  sourceReliability: number;
  amenityUncertaintyPenalty: number;
  unclearFeePenalty: number;
  riskPenalty: number;
  penalties: number;
  total: number;
  confidence: number;
}

export interface DealResult {
  listing: Listing;
  score: ScoreBreakdown;
  accepted: boolean;
  reasons: string[];
  manualVerification: string[];
  isNew: boolean;
}

export function evidenceConfidence(evidence: Evidence): number {
  switch (evidence.status) {
    case "confirmed":
      return 1;
    case "inferred":
      return 0.65;
    case "ambiguous":
      return 0.35;
    case "missing":
      return 0;
  }
}

export function missingEvidence(detail = "No evidence available."): Evidence {
  return { status: "missing", detail };
}

export function stableListingKey(listing: Listing): string {
  return [
    listing.source.toLowerCase(),
    listing.city.toLowerCase(),
    listing.sourceListingId.toLowerCase(),
    listing.dates.checkIn,
    String(listing.dates.nights)
  ].join("|");
}
