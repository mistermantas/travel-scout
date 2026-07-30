import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CityConfig } from "./models.js";

export interface DateHorizon {
  startMonthsFromNow: number;
  endMonthsFromNow: number;
  stepDays: number;
}

export interface MinimumRating {
  tenPoint: number;
  fivePoint: number;
}

export interface AcceptableTransit {
  minConfidence: number;
  reasonableCommuteMinutes: number;
}

export interface AppConfig {
  cities: CityConfig[];
  excludedCities: string[];
  maxNightlyPriceEur: number;
  preferredNightlyPriceEur: number;
  pricePenaltyThresholdEur: number;
  stayLengths: number[];
  dateHorizon: DateHorizon;
  minimumRating: MinimumRating;
  minimumReviewCount: number;
  requiredAmenities: string[];
  manualCheckAmenities: string[];
  acceptableTransit: AcceptableTransit;
  sourcesEnabled: string[];
  allowSharedRooms: boolean;
  minValueScoreForOverPreferredPrice: number;
  reportTopN: number;
  statePath: string;
}

export interface RawCityConfig {
  name: string;
  country?: string;
  center?: [number, number];
  central_radius_km?: number;
  accepted_transit_modes?: string[];
  aliases?: string[];
}

export interface RawConfig {
  cities: RawCityConfig[];
  excluded_cities?: string[];
  max_nightly_price_eur: number;
  preferred_nightly_price_eur: number;
  price_penalty_threshold_eur?: number;
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
  manual_check_amenities?: string[];
  acceptable_transit: {
    min_confidence: number;
    reasonable_commute_minutes: number;
  };
  sources_enabled?: string[];
  allow_shared_rooms?: boolean;
  min_value_score_for_over_preferred_price?: number;
  report_top_n?: number;
  state_path?: string;
}

export async function loadRawConfig(configPath: string): Promise<RawConfig> {
  const parsed: unknown = JSON.parse(await readFile(path.resolve(configPath), "utf8"));
  assertRecord(parsed, "config");
  return parsed as unknown as RawConfig;
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const resolvedPath = path.resolve(configPath);
  return parseConfig(await loadRawConfig(resolvedPath), path.dirname(resolvedPath));
}

export function parseConfig(input: unknown, configDir = process.cwd()): AppConfig {
  assertRecord(input, "config");
  const raw = input as unknown as RawConfig;
  assertArray(raw.cities, "cities");
  if (raw.cities.length === 0) throw new Error("cities must contain at least one city.");

  const cities = raw.cities.map((city, index) => parseCity(city, index));
  const preferred = finiteNumber(raw.preferred_nightly_price_eur, "preferred_nightly_price_eur", { min: 1 });
  const maximum = finiteNumber(raw.max_nightly_price_eur, "max_nightly_price_eur", { min: preferred });
  const penaltyThreshold = finiteNumber(
    raw.price_penalty_threshold_eur ?? maximum,
    "price_penalty_threshold_eur",
    { min: preferred, max: maximum }
  );

  assertArray(raw.stay_lengths, "stay_lengths");
  const stayLengths = uniqueNumbers(raw.stay_lengths, "stay_lengths", { min: 1, max: 30 });
  if (stayLengths.length === 0) throw new Error("stay_lengths must contain at least one night count.");

  assertRecord(raw.date_horizon, "date_horizon");
  const startMonths = finiteNumber(raw.date_horizon.start_months_from_now, "date_horizon.start_months_from_now", {
    min: 0,
    integer: true
  });
  const endMonths = finiteNumber(raw.date_horizon.end_months_from_now, "date_horizon.end_months_from_now", {
    min: startMonths,
    max: 36,
    integer: true
  });
  const stepDays = finiteNumber(raw.date_horizon.step_days, "date_horizon.step_days", {
    min: 1,
    max: 120,
    integer: true
  });

  assertRecord(raw.minimum_rating, "minimum_rating");
  const tenPoint = finiteNumber(raw.minimum_rating.ten_point, "minimum_rating.ten_point", { min: 0, max: 10 });
  const fivePoint = finiteNumber(raw.minimum_rating.five_point, "minimum_rating.five_point", { min: 0, max: 5 });
  const minimumReviewCount = finiteNumber(raw.minimum_review_count, "minimum_review_count", {
    min: 0,
    integer: true
  });

  const requiredAmenities = stringArray(raw.required_amenities, "required_amenities");
  if (requiredAmenities.length === 0) throw new Error("required_amenities must contain at least one amenity.");
  const manualCheckAmenities = stringArray(
    raw.manual_check_amenities ?? ["blackout_window_covering"],
    "manual_check_amenities"
  );
  for (const amenity of manualCheckAmenities) {
    if (!requiredAmenities.includes(amenity)) {
      throw new Error(`manual_check_amenities contains "${amenity}", which is not in required_amenities.`);
    }
  }

  assertRecord(raw.acceptable_transit, "acceptable_transit");
  const minConfidence = finiteNumber(raw.acceptable_transit.min_confidence, "acceptable_transit.min_confidence", {
    min: 0,
    max: 1
  });
  const reasonableCommuteMinutes = finiteNumber(
    raw.acceptable_transit.reasonable_commute_minutes,
    "acceptable_transit.reasonable_commute_minutes",
    { min: 1, max: 180, integer: true }
  );
  const sourcesEnabled = stringArray(raw.sources_enabled ?? ["fixture"], "sources_enabled");
  if (sourcesEnabled.length === 0) throw new Error("sources_enabled must contain at least one source.");

  return {
    cities,
    excludedCities: stringArray(raw.excluded_cities ?? [], "excluded_cities"),
    maxNightlyPriceEur: maximum,
    preferredNightlyPriceEur: preferred,
    pricePenaltyThresholdEur: penaltyThreshold,
    stayLengths,
    dateHorizon: {
      startMonthsFromNow: startMonths,
      endMonthsFromNow: endMonths,
      stepDays
    },
    minimumRating: { tenPoint, fivePoint },
    minimumReviewCount,
    requiredAmenities,
    manualCheckAmenities,
    acceptableTransit: {
      minConfidence,
      reasonableCommuteMinutes
    },
    sourcesEnabled,
    allowSharedRooms: Boolean(raw.allow_shared_rooms ?? false),
    minValueScoreForOverPreferredPrice: finiteNumber(
      raw.min_value_score_for_over_preferred_price ?? 70,
      "min_value_score_for_over_preferred_price",
      { min: 0, max: 100 }
    ),
    reportTopN: finiteNumber(raw.report_top_n ?? 20, "report_top_n", { min: 1, max: 500, integer: true }),
    statePath: path.resolve(configDir, nonEmptyString(raw.state_path ?? "data/seen_results.json", "state_path"))
  };
}

export function configToRaw(config: AppConfig, configDir = process.cwd()): RawConfig {
  return {
    cities: config.cities.map((city) => ({
      name: city.name,
      ...(city.aliases.length ? { aliases: city.aliases } : {}),
      country: city.country,
      ...(city.center ? { center: city.center } : {}),
      central_radius_km: city.centralRadiusKm,
      accepted_transit_modes: city.acceptedTransitModes
    })),
    excluded_cities: config.excludedCities,
    max_nightly_price_eur: config.maxNightlyPriceEur,
    preferred_nightly_price_eur: config.preferredNightlyPriceEur,
    price_penalty_threshold_eur: config.pricePenaltyThresholdEur,
    stay_lengths: config.stayLengths,
    date_horizon: {
      start_months_from_now: config.dateHorizon.startMonthsFromNow,
      end_months_from_now: config.dateHorizon.endMonthsFromNow,
      step_days: config.dateHorizon.stepDays
    },
    minimum_rating: {
      ten_point: config.minimumRating.tenPoint,
      five_point: config.minimumRating.fivePoint
    },
    minimum_review_count: config.minimumReviewCount,
    required_amenities: config.requiredAmenities,
    manual_check_amenities: config.manualCheckAmenities,
    acceptable_transit: {
      min_confidence: config.acceptableTransit.minConfidence,
      reasonable_commute_minutes: config.acceptableTransit.reasonableCommuteMinutes
    },
    sources_enabled: config.sourcesEnabled,
    allow_shared_rooms: config.allowSharedRooms,
    min_value_score_for_over_preferred_price: config.minValueScoreForOverPreferredPrice,
    report_top_n: config.reportTopN,
    state_path: relativeOrOriginal(config.statePath, configDir)
  };
}

function parseCity(value: unknown, index: number): CityConfig {
  const label = `cities[${index}]`;
  assertRecord(value, label);
  const city = value as unknown as RawCityConfig;
  let center: [number, number] | undefined;
  if (city.center !== undefined) {
    assertArray(city.center, `${label}.center`);
    if (city.center.length !== 2) throw new Error(`${label}.center must contain latitude and longitude.`);
    center = [
      finiteNumber(city.center[0], `${label}.center[0]`, { min: -90, max: 90 }),
      finiteNumber(city.center[1], `${label}.center[1]`, { min: -180, max: 180 })
    ];
  }
  return {
    name: nonEmptyString(city.name, `${label}.name`),
    country: nonEmptyString(city.country ?? "", `${label}.country`, true),
    center,
    centralRadiusKm: finiteNumber(city.central_radius_km ?? 4, `${label}.central_radius_km`, { min: 0.1, max: 100 }),
    acceptedTransitModes: stringArray(city.accepted_transit_modes ?? [], `${label}.accepted_transit_modes`),
    aliases: stringArray(city.aliases ?? [], `${label}.aliases`)
  };
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
}

function nonEmptyString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
  return value.trim();
}

function stringArray(value: unknown, label: string): string[] {
  assertArray(value, label);
  return Array.from(new Set(value.map((item, index) => nonEmptyString(item, `${label}[${index}]`))));
}

function uniqueNumbers(
  value: unknown[],
  label: string,
  options: { min?: number; max?: number; integer?: boolean }
): number[] {
  return Array.from(
    new Set(value.map((item, index) => finiteNumber(item, `${label}[${index}]`, options)))
  ).sort((first, second) => first - second);
}

function finiteNumber(
  value: unknown,
  label: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${label} must be an integer.`);
  if (options.min !== undefined && parsed < options.min) throw new Error(`${label} must be at least ${options.min}.`);
  if (options.max !== undefined && parsed > options.max) throw new Error(`${label} must be at most ${options.max}.`);
  return parsed;
}

function relativeOrOriginal(targetPath: string, baseDir: string): string {
  const relative = path.relative(baseDir, targetPath);
  return relative && !relative.startsWith("..") ? relative : targetPath;
}
