from datetime import date
from pathlib import Path
import unittest

from travel_deals.config import AcceptableTransit, AppConfig, DateHorizon, MinimumRating
from travel_deals.filtering import evaluate_listing
from travel_deals.models import DateWindow, Evidence, Listing


def _config() -> AppConfig:
    return AppConfig(
        cities=(),
        excluded_cities=("Vilnius",),
        max_nightly_price_eur=50,
        preferred_nightly_price_eur=35,
        stay_lengths=(2, 3, 4, 5, 6),
        date_horizon=DateHorizon(3, 9, 21),
        minimum_rating=MinimumRating(8.0, 4.5),
        minimum_review_count=25,
        required_amenities=("adjustable_climate_control", "kitchen_or_kitchenette", "stovetop"),
        acceptable_transit=AcceptableTransit(0.55, 35),
        sources_enabled=("fixture",),
        allow_shared_rooms=False,
        min_value_score_for_over_preferred_price=70,
        report_top_n=20,
        state_path=Path("data/seen_results.json"),
    )


def _listing(**overrides) -> Listing:
    values = {
        "source": "fixture",
        "source_reliability": 0.62,
        "source_listing_id": "x",
        "name": "Private studio",
        "url": "https://example.com/x",
        "city": "Berlin",
        "neighborhood": "Wedding",
        "dates": DateWindow(date(2026, 10, 4), date(2026, 10, 7), 3),
        "total_price_eur": 99,
        "nightly_price_eur": 33,
        "rating": 8.5,
        "rating_scale": 10,
        "review_count": 50,
        "amenities": {
            "adjustable_climate_control": Evidence("confirmed", "yes"),
            "kitchen_or_kitchenette": Evidence("confirmed", "yes"),
            "stovetop": Evidence("confirmed", "yes"),
        },
        "transit": Evidence("confirmed", "central"),
        "cancellation_policy": "Free cancellation",
    }
    values.update(overrides)
    return Listing(**values)


class FilteringTests(unittest.TestCase):
    def test_rejects_shared_room_when_config_disallows_it(self):
        result = evaluate_listing(_listing(room_type="bed in shared dorm"), _config())

        self.assertFalse(result.accepted)
        self.assertTrue(any("dorm/shared-room" in reason for reason in result.reasons))


    def test_ambiguous_amenity_requires_manual_verification_but_can_pass(self):
        listing = _listing()
        listing.amenities["adjustable_climate_control"] = Evidence("ambiguous", "AC, control unclear")
        result = evaluate_listing(listing, _config())

        self.assertTrue(result.accepted)
        self.assertTrue(any("Verify adjustable climate control" in item for item in result.manual_verification))

    def test_over_preferred_price_requires_strong_value_score(self):
        config = _config()
        listing = _listing(nightly_price_eur=49, total_price_eur=147, review_count=5)
        listing.amenities["adjustable_climate_control"] = Evidence("ambiguous", "AC, control unclear")
        listing.amenities["stovetop"] = Evidence("ambiguous", "hob unclear")
        result = evaluate_listing(listing, config)

        self.assertFalse(result.accepted)
        self.assertTrue(any("value score is not strong enough" in reason for reason in result.reasons))


if __name__ == "__main__":
    unittest.main()
