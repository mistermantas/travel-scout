export type EvidenceStatus = "confirmed" | "inferred" | "ambiguous" | "missing";

export interface Evidence {
  status: EvidenceStatus;
  detail: string;
  source?: string;
}

export interface CityConfig {
  name: string;
  aliases?: string[];
  country: string;
  center: [number, number];
  central_radius_km: number;
  accepted_transit_modes: string[];
}

export interface TravelConfig {
  cities: CityConfig[];
  excluded_cities: string[];
  max_nightly_price_eur: number;
  preferred_nightly_price_eur: number;
  price_penalty_threshold_eur: number;
  stay_lengths: number[];
  date_horizon: {
    start_months_from_now: number;
    end_months_from_now: number;
    step_days: number;
  };
  minimum_rating: {
    ten_point: number;
    five_point: number;
  };
  minimum_review_count: number;
  required_amenities: string[];
  manual_check_amenities: string[];
  acceptable_transit: {
    min_confidence: number;
    reasonable_commute_minutes: number;
  };
  sources_enabled: string[];
  allow_shared_rooms: boolean;
  min_value_score_for_over_preferred_price: number;
  report_top_n: number;
  state_path: string;
}

export interface Deal {
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
  rating: number;
  rating_scale: number;
  review_count: number;
  amenity_evidence: Record<string, Evidence>;
  transit_accessibility_evidence: Evidence;
  confidence_score: number;
  value_score: number;
  source_metadata: {
    fetched_at?: string;
    source_tool?: string;
    pricing_note?: string;
    evidence_urls?: string[];
  };
  score_breakdown: Record<string, number>;
  why: string[];
  manual_verification: string[];
  rejection_reasons?: string[];
}

export interface SourceRun {
  name: string;
  status: "ok" | "empty" | "error";
  candidateCount: number;
  acceptedCount: number;
  error?: string;
}

export interface CheckPayload {
  generated_at: string;
  summary: {
    candidates: number;
    accepted: number;
    excluded: number;
    newAccepted: number;
    windowCount: number;
    cityCount: number;
  };
  sources: SourceRun[];
  results: Deal[];
}

export interface SourceCatalogItem {
  id: string;
  label: string;
  kind: string;
}

export interface BootstrapPayload {
  config: TravelConfig;
  default_config: TravelConfig;
  using_local_config: boolean;
  source_catalog: SourceCatalogItem[];
  check: CheckPayload;
}

export type AppTab = "explore" | "saved" | "settings";
