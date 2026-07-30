import type { AppConfig } from "./config.js";
import { missingEvidence, type DealResult, type Evidence, type Listing } from "./models.js";
import { scoreListing } from "./scoring.js";

const SHARED_ROOM_TERMS = ["dorm", "shared room", "bed in", "hostel bed"];

export function evaluateListing(listing: Listing, config: AppConfig, isNew = true): DealResult {
  const reasons: string[] = [];
  const manual: string[] = [];
  let accepted = true;
  const manualCheckAmenities = new Set(config.manualCheckAmenities);

  const excluded = new Set(config.excludedCities.map((city) => city.toLowerCase()));
  if (excluded.has(listing.city.toLowerCase())) {
    accepted = false;
    reasons.push(`${listing.city} is excluded by config.`);
  }

  if (listing.nightlyPriceEur > config.maxNightlyPriceEur) {
    accepted = false;
    reasons.push(`Nightly price EUR ${listing.nightlyPriceEur.toFixed(2)} is above the configured maximum.`);
  } else if (listing.nightlyPriceEur > config.pricePenaltyThresholdEur) {
    reasons.push(
      `Nightly price is in the expanded EUR ${config.pricePenaltyThresholdEur.toFixed(0)}-${config.maxNightlyPriceEur.toFixed(0)} band; score penalty applied.`
    );
  } else if (listing.nightlyPriceEur <= config.preferredNightlyPriceEur) {
    reasons.push("Nightly price is inside the preferred band.");
  } else {
    reasons.push("Nightly price is above the preferred band but inside the hard cap.");
  }

  if (!config.stayLengths.includes(listing.dates.nights)) {
    accepted = false;
    reasons.push(`Stay length ${listing.dates.nights} nights is outside the configured ${formatStayLengths(config.stayLengths)} range.`);
  }

  if (feesAreUnclear(listing)) {
    reasons.push("Displayed price is preliminary; taxes, city taxes, cleaning fees, or service fees may still change the checkout total.");
  }

  if (taxesAreExcluded(listing)) {
    reasons.push("Displayed price excludes taxes or mandatory fees; use it as preliminary discovery price only.");
  }

  const roomType = `${listing.roomType} ${listing.name}`.toLowerCase();
  if (!config.allowSharedRooms && SHARED_ROOM_TERMS.some((term) => roomType.includes(term))) {
    accepted = false;
    reasons.push("Listing appears to be a dorm/shared-room option.");
  }

  if (listing.rating === null) {
    manual.push("Confirm rating on the source page; the adapter did not receive it.");
  } else {
    const ratingOnTen = listing.ratingScale === 5 ? listing.rating * 2 : listing.rating;
    if (ratingOnTen < config.minimumRating.tenPoint) {
      accepted = false;
      reasons.push(`Rating ${ratingOnTen.toFixed(1)}/10 is below the configured minimum.`);
    }
  }

  if (listing.reviewCount === null) {
    manual.push("Confirm review count; the adapter did not receive it.");
  } else if (listing.reviewCount < config.minimumReviewCount) {
    reasons.push("Review count is thin, so confidence is reduced.");
  }

  for (const amenity of config.requiredAmenities) {
    const evidence = listing.amenities[amenity] ?? missingEvidence();
    if (evidence.status === "missing") {
      if (manualCheckAmenities.has(amenity)) {
        reasons.push(`${amenity.replaceAll("_", " ")} needs manual check.`);
        manual.push(`Check ${amenity.replaceAll("_", " ")}: ${evidence.detail}`);
      } else {
        accepted = false;
        reasons.push(`${amenity.replaceAll("_", " ")} is not evidenced.`);
      }
    } else if (evidence.status === "ambiguous" || evidence.status === "inferred") {
      if (manualCheckAmenities.has(amenity)) {
        reasons.push(`${amenity.replaceAll("_", " ")} is ${evidence.status}; check manually.`);
        manual.push(`Check ${amenity.replaceAll("_", " ")}: ${evidence.detail}`);
      } else {
        accepted = false;
        reasons.push(`${amenity.replaceAll("_", " ")} is ${evidence.status}; direct confirmation is required.`);
        manual.push(`Verify ${amenity.replaceAll("_", " ")}: ${evidence.detail}`);
      }
    }
  }

  if (evidenceConfidenceForFilter(listing.transit) < config.acceptableTransit.minConfidence) {
    accepted = false;
    reasons.push("Transit accessibility confidence is below the configured minimum.");
  } else if (listing.transit.status !== "confirmed") {
    manual.push(`Verify public-transport access: ${listing.transit.detail}`);
  }

  if (listing.cancellationPolicy) {
    manual.push(`Check cancellation terms still match: ${listing.cancellationPolicy}`);
  } else {
    manual.push("Check cancellation/refund terms; none were provided by the adapter.");
  }

  if (listing.nightlyPriceEur <= config.preferredNightlyPriceEur * 0.45) {
    manual.push("Suspiciously low price: verify taxes, fees, room type, and whether it is a private unit.");
  }

  const score = scoreListing(listing, config);
  if (
    accepted &&
    listing.nightlyPriceEur > config.preferredNightlyPriceEur &&
    listing.nightlyPriceEur <= config.pricePenaltyThresholdEur &&
    score.total < config.minValueScoreForOverPreferredPrice
  ) {
    accepted = false;
    reasons.push(
      `Nightly price is above the preferred band and the value score is not strong enough (${score.total.toFixed(2)} < ${config.minValueScoreForOverPreferredPrice.toFixed(2)}).`
    );
  }

  if (score.unclearFeePenalty > 0) {
    manual.push("Verify whether taxes, cleaning fees, service fees, and city taxes are included in the total.");
  }

  if (accepted) {
    reasons.push("Accepted as a candidate because hard filters passed; confidence still depends on evidence quality.");
  }

  return {
    listing,
    score,
    accepted,
    reasons,
    manualVerification: Array.from(new Set(manual)),
    isNew
  };
}

function evidenceConfidenceForFilter(evidence: Evidence): number {
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

function formatStayLengths(stayLengths: number[]): string {
  if (stayLengths.length === 0) return "allowed stay length";
  const sorted = [...stayLengths].sort((first, second) => first - second);
  const contiguous = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  if (contiguous && sorted.length > 1) return `${sorted[0]}-${sorted[sorted.length - 1]} night`;
  return `${sorted.join(", ")} night`;
}

function feesAreUnclear(listing: Listing): boolean {
  return listing.raw.fees_unclear === true || listing.raw.feesUnclear === true;
}

function taxesAreExcluded(listing: Listing): boolean {
  if (listing.raw.taxes_and_fees_included === false || listing.raw.taxesAndFeesIncluded === false) return true;
  const pricingContext = listing.raw.pricing_context;
  if (isRecord(pricingContext)) {
    if (pricingContext.taxes_and_fees_included === false || pricingContext.taxesAndFeesIncluded === false) return true;
    if (pricingContext.tax === "TAXES_EXCLUDED") return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
