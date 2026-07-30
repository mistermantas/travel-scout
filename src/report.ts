import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./config.js";
import { missingEvidence, type DealResult, type Listing } from "./models.js";

export interface JsonDealResult {
  accepted: boolean;
  is_new: boolean;
  city: string;
  neighborhood: string;
  source: string;
  listing_name: string;
  url: string;
  dates_tested: string;
  stay_length: number;
  total_price_eur: number;
  nightly_equivalent_eur: number;
  rating: number | null;
  rating_scale: number;
  review_count: number | null;
  amenity_evidence: Record<string, { status: string; detail: string; source?: string }>;
  transit_accessibility_evidence: { status: string; detail: string; source?: string };
  confidence_score: number;
  value_score: number;
  source_metadata: Record<string, unknown>;
  score_breakdown: Record<string, number>;
  why: string[];
  manual_verification: string[];
}

const REQUIRED_AMENITIES = [
  "adjustable_climate_control",
  "kitchen_or_kitchenette",
  "stovetop",
  "utensils",
  "blackout_window_covering"
];
const YELLOW = "\u001b[33m";
const RESET = "\u001b[0m";

export function resultToDict(result: DealResult): JsonDealResult {
  const listing = result.listing;
  return {
    accepted: result.accepted,
    is_new: result.isNew,
    city: listing.city,
    neighborhood: listing.neighborhood,
    source: listing.source,
    listing_name: listing.name,
    url: listing.url,
    dates_tested: listing.dates.label,
    stay_length: listing.dates.nights,
    total_price_eur: listing.totalPriceEur,
    nightly_equivalent_eur: listing.nightlyPriceEur,
    rating: listing.rating,
    rating_scale: listing.ratingScale,
    review_count: listing.reviewCount,
    amenity_evidence: Object.fromEntries(
      Object.entries(listing.amenities).map(([key, evidence]) => [
        key,
        { status: evidence.status, detail: evidence.detail, source: evidence.source }
      ])
    ),
    transit_accessibility_evidence: {
      status: listing.transit.status,
      detail: listing.transit.detail,
      source: listing.transit.source
    },
    confidence_score: result.score.confidence,
    value_score: result.score.total,
    source_metadata: {
      fetched_at: listing.raw.fetched_at,
      source_tool: listing.raw.source_tool,
      pricing_note: listing.raw.pricing_note,
      evidence_urls: listing.raw.evidence_urls
    },
    score_breakdown: {
      price: result.score.price,
      rating: result.score.rating,
      review_confidence: result.score.reviewConfidence,
      amenity_match: result.score.amenityMatch,
      transit: result.score.transit,
      stay_length: result.score.stayLength,
      cancellation: result.score.cancellation,
      source_reliability: result.score.sourceReliability,
      amenity_uncertainty_penalty: result.score.amenityUncertaintyPenalty,
      unclear_fee_penalty: result.score.unclearFeePenalty,
      risk_penalty: result.score.riskPenalty,
      penalties: result.score.penalties,
      total: result.score.total,
      confidence: result.score.confidence
    },
    why: result.reasons,
    manual_verification: result.manualVerification
  };
}

export async function writeJsonReport(results: DealResult[], outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(results.map(resultToDict), null, 2)}\n`, "utf8");
}

export async function writeMarkdownReport(results: DealResult[], outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const acceptedCount = results.filter((result) => result.accepted).length;
  const rejectedCount = results.length - acceptedCount;
  const lines = [
    "# Travel Deal Candidates",
    "",
    `Accepted candidates: ${acceptedCount}`,
    `Rejected candidates shown: ${rejectedCount}`,
    ""
  ];
  if (results.length === 0) {
    lines.push("No candidates matched the current configuration.");
  }
  results.forEach((result, index) => {
    const listing = result.listing;
    const status = result.accepted ? "accepted" : "rejected";
    lines.push(
      `## ${index + 1}. ${listing.name} (${status})`,
      "",
      `- City: ${listing.city}`,
      `- Neighborhood/area: ${listing.neighborhood || "Unknown"}`,
      `- Source: ${listing.source}`,
      `- URL: ${listing.url || "No direct URL provided by adapter"}`,
      `- Dates tested: ${listing.dates.label}`,
      `- Stay length: ${listing.dates.nights} nights`,
      `- Total price: EUR ${listing.totalPriceEur.toFixed(2)}`,
      `- Nightly equivalent: EUR ${listing.nightlyPriceEur.toFixed(2)}`,
      `- Rating and review count: ${ratingLabel(listing)}`,
      `- Transit accessibility evidence: ${listing.transit.status} - ${listing.transit.detail}`,
      `- Confidence score: ${result.score.confidence.toFixed(2)}`,
      `- Value score: ${result.score.total.toFixed(2)}`,
      `- Source evidence: ${sourceEvidenceLabel(listing)}`,
      "",
      "Amenity evidence:"
    );
    for (const key of REQUIRED_AMENITIES) {
      const evidence = listing.amenities[key] ?? missingEvidence();
      lines.push(`- ${key.replaceAll("_", " ")}: ${evidence.status} - ${evidence.detail}`);
    }
    lines.push(
      "",
      "Why it is a good deal / why rejected:",
      ...result.reasons.map((reason) => `- ${reason}`),
      "",
      "Manual verification before booking:",
      ...result.manualVerification.map((item) => `- ${item}`),
      ""
    );
  });
  await writeFile(outputPath, lines.join("\n"), "utf8");
}

export function formatAcceptedDealsForConsole(results: DealResult[], config?: AppConfig): string {
  const accepted = results.filter((result) => result.accepted);
  if (accepted.length === 0) {
    return "Accepted deals: 0";
  }

  const lines = [`Accepted deals: ${accepted.length}`, ""];
  accepted.forEach((result, index) => {
    const listing = result.listing;
    lines.push(
      `${index + 1}. ${listing.name}`,
      `   ${listing.city} / ${listing.neighborhood || "Unknown area"}`,
      `   ${listing.dates.label}, ${listing.dates.nights} nights`,
      `   EUR ${listing.totalPriceEur.toFixed(2)} total / EUR ${listing.nightlyPriceEur.toFixed(2)} nightly`,
      `   ${ratingLabel(listing)} | value ${result.score.total.toFixed(2)} | confidence ${result.score.confidence.toFixed(2)}`,
      `   ${listing.url}`,
    );
    const manualAmenities = config?.manualCheckAmenities ?? ["blackout_window_covering"];
    for (const amenity of manualAmenities) {
      const evidence = listing.amenities[amenity] ?? missingEvidence();
      if (evidence.status !== "confirmed") {
        const label = amenity === "blackout_window_covering" ? "blackout" : amenity.replaceAll("_", " ");
        lines.push(
          `${YELLOW}   WARNING: ${label} needs manual check (${evidence.status}) - ${evidence.detail}${RESET}`
        );
      }
    }
    const threshold = config?.pricePenaltyThresholdEur ?? 50;
    if (listing.nightlyPriceEur > threshold) {
      lines.push(`${YELLOW}   WARNING: expanded price band - above EUR ${threshold.toFixed(0)}/night, score penalty applied${RESET}`);
    }
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

function ratingLabel(listing: Listing): string {
  const ratingPart = listing.rating === null ? "unknown rating" : `${listing.rating}/${listing.ratingScale}`;
  const reviewPart = listing.reviewCount === null ? "unknown reviews" : `${listing.reviewCount} reviews`;
  return `${ratingPart}, ${reviewPart}`;
}

function sourceEvidenceLabel(listing: Listing): string {
  const fetchedAt = typeof listing.raw.fetched_at === "string" ? listing.raw.fetched_at : "not provided";
  const tool = typeof listing.raw.source_tool === "string" ? listing.raw.source_tool : listing.source;
  const pricing = typeof listing.raw.pricing_note === "string" ? listing.raw.pricing_note : "No pricing note provided.";
  return `${tool}, fetched ${fetchedAt}. ${pricing}`;
}
