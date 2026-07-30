import type { AppConfig } from "./config.js";
import { evidenceConfidence, missingEvidence, type Evidence, type Listing, type ScoreBreakdown } from "./models.js";

const AMENITY_WEIGHTS: Record<string, number> = {
  adjustable_climate_control: 0.24,
  kitchen_or_kitchenette: 0.23,
  stovetop: 0.2,
  utensils: 0.15,
  blackout_window_covering: 0.18
};

export function priceScore(nightly: number, preferred: number, maximum: number): number {
  if (nightly <= preferred) return 1;
  if (nightly >= maximum) return 0;
  return Math.max(0, 1 - (nightly - preferred) / (maximum - preferred));
}

export function ratingScore(rating: number | null, scale: number, minimumOnTen: number): number {
  if (rating === null) return 0;
  const normalized = (rating / scale) * 10;
  if (normalized < minimumOnTen) {
    return Math.max(0, (normalized / minimumOnTen) * 0.55);
  }
  return Math.min(1, 0.7 + ((normalized - minimumOnTen) / (10 - minimumOnTen)) * 0.3);
}

export function reviewConfidence(reviewCount: number | null, minimum: number): number {
  if (!reviewCount) return 0;
  if (reviewCount >= minimum * 4) return 1;
  return Math.min(1, reviewCount / (minimum * 4));
}

export function amenityMatch(amenities: Record<string, Evidence>, required: string[]): number {
  if (required.length === 0) return 1;
  let weightedTotal = 0;
  let weightSeen = 0;
  const fallbackWeight = 1 / required.length;
  for (const amenity of required) {
    const weight = AMENITY_WEIGHTS[amenity] ?? fallbackWeight;
    weightSeen += weight;
    weightedTotal += evidenceConfidence(amenities[amenity] ?? missingEvidence("Missing")) * weight;
  }
  return weightedTotal / weightSeen;
}

export function amenityUncertaintyPenalty(listing: Listing, config: AppConfig): number {
  let penalty = 0;
  for (const amenity of config.requiredAmenities) {
    const status = (listing.amenities[amenity] ?? missingEvidence("Missing")).status;
    if (status === "missing") penalty += 0.04;
    if (status === "ambiguous") penalty += 0.025;
    if (status === "inferred") penalty += 0.015;
  }
  return penalty;
}

export function cancellationScore(policy: string): number {
  const lower = policy.toLowerCase();
  if (!lower) return 0.35;
  if (lower.includes("free cancellation") || lower.includes("refundable")) return 1;
  if (lower.includes("partial")) return 0.65;
  if (lower.includes("non-refundable") || lower.includes("non refundable")) return 0.15;
  return 0.45;
}

export function unclearFeePenalty(listing: Listing): number {
  let penalty = 0;
  if (listing.raw.fees_unclear === true || listing.raw.feesUnclear === true) penalty += 0.08;
  if (listing.raw.taxes_and_fees_included === false || listing.raw.taxesAndFeesIncluded === false) penalty += 0.05;
  const pricingContext = listing.raw.pricing_context;
  if (isRecord(pricingContext)) {
    if (pricingContext.taxes_and_fees_included === false || pricingContext.taxesAndFeesIncluded === false) penalty += 0.05;
    if (pricingContext.tax === "TAXES_EXCLUDED") penalty += 0.05;
  }
  return penalty;
}

export function riskPenalty(listing: Listing, config: AppConfig): number {
  let penalty = 0;
  if (listing.nightlyPriceEur <= config.preferredNightlyPriceEur * 0.45) penalty += 0.08;
  if (listing.nightlyPriceEur > config.pricePenaltyThresholdEur) {
    const expandedBand = Math.max(1, config.maxNightlyPriceEur - config.pricePenaltyThresholdEur);
    const overageRatio = Math.min(1, (listing.nightlyPriceEur - config.pricePenaltyThresholdEur) / expandedBand);
    penalty += 0.08 + overageRatio * 0.12;
  }
  if (!listing.reviewCount || listing.reviewCount < Math.max(5, Math.floor(config.minimumReviewCount / 3))) {
    penalty += 0.08;
  }
  if (listing.totalPriceEur <= 0 || listing.nightlyPriceEur <= 0) penalty += 0.3;
  return penalty;
}

export function scoreListing(listing: Listing, config: AppConfig): ScoreBreakdown {
  const minimumOnTen = listing.ratingScale === 5 ? config.minimumRating.fivePoint * 2 : config.minimumRating.tenPoint;
  const ratingComponent = ratingScore(listing.rating, listing.ratingScale, minimumOnTen);
  const priceComponent = priceScore(listing.nightlyPriceEur, config.preferredNightlyPriceEur, config.maxNightlyPriceEur);
  const reviewsComponent = reviewConfidence(listing.reviewCount, config.minimumReviewCount);
  const amenitiesComponent = amenityMatch(listing.amenities, config.requiredAmenities);
  const transitComponent = evidenceConfidence(listing.transit);
  const cancellationComponent = cancellationScore(listing.cancellationPolicy);
  const stayLengthComponent = config.stayLengths.includes(listing.dates.nights) ? 1 : 0;
  const sourceComponent = clamp01(listing.sourceReliability);
  const amenityPenalty = amenityUncertaintyPenalty(listing, config);
  const feePenalty = unclearFeePenalty(listing);
  const listingRiskPenalty = riskPenalty(listing, config);
  const penalties = amenityPenalty + feePenalty + listingRiskPenalty;

  const total = clamp(
    priceComponent * 28 +
      ratingComponent * 14 +
      reviewsComponent * 10 +
      amenitiesComponent * 20 +
      transitComponent * 10 +
      stayLengthComponent * 6 +
      cancellationComponent * 5 +
      sourceComponent * 7 -
      penalties * 100,
    0,
    100
  );

  const confidence =
    amenitiesComponent * 0.34 +
    transitComponent * 0.18 +
    reviewsComponent * 0.18 +
    sourceComponent * 0.2 +
    cancellationComponent * 0.1;

  return {
    price: priceComponent,
    rating: ratingComponent,
    reviewConfidence: reviewsComponent,
    amenityMatch: amenitiesComponent,
    transit: transitComponent,
    stayLength: stayLengthComponent,
    cancellation: cancellationComponent,
    sourceReliability: sourceComponent,
    amenityUncertaintyPenalty: round(amenityPenalty, 3),
    unclearFeePenalty: round(feePenalty, 3),
    riskPenalty: round(listingRiskPenalty, 3),
    penalties: round(penalties, 3),
    total: round(total, 2),
    confidence: round(confidence, 2)
  };
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
