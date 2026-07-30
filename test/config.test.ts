import assert from "node:assert/strict";
import test from "node:test";
import { configToRaw, parseConfig } from "../src/config.js";

const RAW_CONFIG = {
  cities: [
    {
      name: "Warsaw",
      country: "PL",
      center: [52.2297, 21.0122],
      central_radius_km: 4.5,
      accepted_transit_modes: ["metro"]
    }
  ],
  excluded_cities: ["Vilnius"],
  max_nightly_price_eur: 80,
  preferred_nightly_price_eur: 35,
  price_penalty_threshold_eur: 50,
  stay_lengths: [2, 3, 4, 5, 6],
  date_horizon: {
    start_months_from_now: 0,
    end_months_from_now: 6,
    step_days: 21
  },
  minimum_rating: {
    ten_point: 8,
    five_point: 4.5
  },
  minimum_review_count: 25,
  required_amenities: ["adjustable_climate_control", "blackout_window_covering"],
  manual_check_amenities: ["blackout_window_covering"],
  acceptable_transit: {
    min_confidence: 0.55,
    reasonable_commute_minutes: 35
  },
  sources_enabled: ["booking_snapshot"],
  allow_shared_rooms: false,
  min_value_score_for_over_preferred_price: 70,
  report_top_n: 20,
  state_path: "data/seen_results.json"
};

test("parseConfig preserves preferred price bands and manual-check amenities", () => {
  const config = parseConfig(RAW_CONFIG, "/tmp/travel-scout");

  assert.equal(config.preferredNightlyPriceEur, 35);
  assert.equal(config.pricePenaltyThresholdEur, 50);
  assert.equal(config.maxNightlyPriceEur, 80);
  assert.deepEqual(config.manualCheckAmenities, ["blackout_window_covering"]);
  assert.equal(configToRaw(config, "/tmp/travel-scout").state_path, "data/seen_results.json");
});

test("parseConfig rejects contradictory price bands", () => {
  assert.throws(
    () => parseConfig({ ...RAW_CONFIG, price_penalty_threshold_eur: 90 }),
    /price_penalty_threshold_eur must be at most 80/
  );
});

test("parseConfig rejects manual-check amenities outside required amenities", () => {
  assert.throws(
    () => parseConfig({ ...RAW_CONFIG, manual_check_amenities: ["private_pool"] }),
    /not in required_amenities/
  );
});
