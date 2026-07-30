from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from travel_deals.models import CityConfig, DateWindow, Evidence, Listing
from travel_deals.sources.base import SourceAdapter
from travel_deals.transit import estimate_transit_accessibility


class FixtureSource(SourceAdapter):
    name = "fixture"

    def __init__(self, path: Path):
        self.path = path

    def search(self, cities: list[CityConfig], windows: list[DateWindow]) -> list[Listing]:
        city_by_name = {city.name.lower(): city for city in cities}
        data = json.loads(self.path.read_text(encoding="utf-8"))
        listings: list[Listing] = []
        for item in data["listings"]:
            city = city_by_name.get(item["city"].lower())
            if city is None:
                continue
            for window in windows:
                if window.nights not in item.get("available_stay_lengths", []):
                    continue
                nightly = float(item["nightly_price_eur"])
                listing = self._listing_from_item(item, window, nightly)
                listing.transit = estimate_transit_accessibility(listing, city)
                listings.append(listing)
                break
        return listings

    def _listing_from_item(self, item: dict[str, Any], window: DateWindow, nightly: float) -> Listing:
        amenities = {
            key: Evidence(value["status"], value["detail"], self.name)
            for key, value in item.get("amenities", {}).items()
        }
        return Listing(
            source=self.name,
            source_reliability=float(item.get("source_reliability", 0.6)),
            source_listing_id=str(item["source_listing_id"]),
            name=item["name"],
            url=item["url"],
            city=item["city"],
            neighborhood=item.get("neighborhood", ""),
            dates=window,
            total_price_eur=round(nightly * window.nights, 2),
            nightly_price_eur=nightly,
            rating=item.get("rating"),
            rating_scale=float(item.get("rating_scale", 10)),
            review_count=item.get("review_count"),
            location_text=item.get("location_text", ""),
            latitude=item.get("latitude"),
            longitude=item.get("longitude"),
            room_type=item.get("room_type", ""),
            cancellation_policy=item.get("cancellation_policy", ""),
            amenities=amenities,
            raw=item,
        )
