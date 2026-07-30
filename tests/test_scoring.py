from datetime import date
import unittest

from travel_deals.config import AcceptableTransit, AppConfig, DateHorizon, MinimumRating
from travel_deals.models import DateWindow, Evidence, Listing
from travel_deals.scoring import price_score, score_listing


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
        required_amenities=(
            "adjustable_climate_control",
            "kitchen_or_kitchenette",
            "stovetop",
            "utensils",
            "blackout_window_covering",
        ),
        acceptable_transit=AcceptableTransit(0.55, 35),
        sources_enabled=("fixture",),
        allow_shared_rooms=False,
        min_value_score_for_over_preferred_price=70,
        report_top_n=20,
        state_path="data/seen_results.json",
    )


def _listing(nightly: float = 32) -> Listing:
    return Listing(
        source="fixture",
        source_reliability=0.62,
        source_listing_id="x",
        name="Test private studio",
        url="https://example.com/x",
        city="Warsaw",
        neighborhood="Central",
        dates=DateWindow(date(2026, 10, 4), date(2026, 10, 7), 3),
        total_price_eur=nightly * 3,
        nightly_price_eur=nightly,
        rating=8.7,
        rating_scale=10,
        review_count=80,
        amenities={
            "adjustable_climate_control": Evidence("confirmed", "yes"),
            "kitchen_or_kitchenette": Evidence("confirmed", "yes"),
            "stovetop": Evidence("confirmed", "yes"),
            "utensils": Evidence("confirmed", "yes"),
            "blackout_window_covering": Evidence("confirmed", "yes"),
        },
        transit=Evidence("confirmed", "central"),
        cancellation_policy="Free cancellation",
    )


class ScoringTests(unittest.TestCase):
    def test_price_score_strongly_favors_under_preferred_price(self):
        self.assertEqual(price_score(30, 35, 50), 1.0)
        self.assertEqual(price_score(50, 35, 50), 0.0)
        self.assertTrue(0.0 < price_score(42, 35, 50) < 1.0)


    def test_missing_required_amenity_reduces_score(self):
        config = _config()
        strong = score_listing(_listing(), config)
        weak_listing = _listing()
        weak_listing.amenities["stovetop"] = Evidence("missing", "no")
        weak = score_listing(weak_listing, config)

        self.assertGreater(strong.total, weak.total)
        self.assertGreater(strong.confidence, weak.confidence)

    def test_unclear_fees_add_explicit_penalty(self):
        config = _config()
        clear = score_listing(_listing(), config)
        unclear_listing = _listing()
        unclear_listing.raw["fees_unclear"] = True
        unclear = score_listing(unclear_listing, config)

        self.assertGreater(unclear.unclear_fee_penalty, 0)
        self.assertGreater(clear.total, unclear.total)


if __name__ == "__main__":
    unittest.main()
