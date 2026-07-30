from __future__ import annotations

import json
import os
from collections.abc import Iterable
from urllib.parse import urlencode
from urllib.request import urlopen

from travel_deals.models import CityConfig, DateWindow, Evidence, Listing
from travel_deals.sources.base import SourceAdapter
from travel_deals.transit import estimate_transit_accessibility


class SerpApiGoogleHotelsSource(SourceAdapter):
    name = "serpapi_google_hotels"

    def __init__(self, api_key: str | None = None, timeout: int = 20):
        self.api_key = api_key or os.getenv("SERPAPI_API_KEY")
        self.timeout = timeout

    def search(self, cities: Iterable[CityConfig], windows: Iterable[DateWindow]) -> list[Listing]:
        if not self.api_key:
            return []

        listings: list[Listing] = []
        for city in cities:
            for window in windows:
                payload = self._fetch(city, window)
                for item in payload.get("properties", [])[:15]:
                    listing = self._normalize(item, city, window)
                    if listing is not None:
                        listing.transit = estimate_transit_accessibility(listing, city)
                        listings.append(listing)
        return listings

    def _fetch(self, city: CityConfig, window: DateWindow) -> dict:
        params = {
            "engine": "google_hotels",
            "q": f"aparthotel apartment hotel {city.name}",
            "check_in_date": window.check_in.isoformat(),
            "check_out_date": window.check_out.isoformat(),
            "adults": "1",
            "currency": "EUR",
            "gl": city.country.lower() or "us",
            "hl": "en",
            "api_key": self.api_key,
        }
        url = f"https://serpapi.com/search.json?{urlencode(params)}"
        with urlopen(url, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def _normalize(self, item: dict, city: CityConfig, window: DateWindow) -> Listing | None:
        rate = item.get("rate_per_night") or item.get("total_rate")
        extracted = None
        if isinstance(rate, dict):
            extracted = rate.get("extracted_lowest") or rate.get("extracted_before_taxes_fees")
        elif isinstance(rate, (int, float)):
            extracted = float(rate)
        if not extracted:
            return None

        total = item.get("total_rate", {})
        total_price = total.get("extracted_lowest") if isinstance(total, dict) else None
        fees_unclear = total_price is None
        nightly = float(extracted)
        if total_price:
            total_price = float(total_price)
            nightly = total_price / window.nights
        else:
            total_price = nightly * window.nights

        gps = item.get("gps_coordinates") or {}
        amenities_text = " ".join(item.get("amenities", [])).lower()
        kitchen_status = "confirmed" if "kitchen" in amenities_text or "kitchenette" in amenities_text else "missing"
        air_status = "ambiguous"
        if "air conditioning" in amenities_text or "climate" in amenities_text:
            air_status = "ambiguous"

        amenities = {
            "adjustable_climate_control": Evidence(
                air_status,
                "Google Hotels may show air conditioning, but individual adjustability usually needs manual confirmation.",
                self.name,
            ),
            "kitchen_or_kitchenette": Evidence(kitchen_status, "Amenity text was checked for kitchen/kitchenette.", self.name),
            "stovetop": Evidence("ambiguous", "Search result amenities rarely distinguish a stovetop.", self.name),
            "utensils": Evidence("ambiguous", "Kitchen inventory is not reliably exposed by Google Hotels search data.", self.name),
            "blackout_window_covering": Evidence("ambiguous", "Blackout curtains/shutters are rarely exposed by Google Hotels search data.", self.name),
        }

        return Listing(
            source=self.name,
            source_reliability=0.72,
            source_listing_id=str(item.get("property_token") or item.get("name")),
            name=item.get("name", "Unnamed property"),
            url=item.get("link") or item.get("serpapi_property_details_link") or "",
            city=city.name,
            neighborhood=item.get("neighborhood", ""),
            dates=window,
            total_price_eur=round(total_price, 2),
            nightly_price_eur=round(nightly, 2),
            rating=item.get("overall_rating"),
            rating_scale=5.0,
            review_count=item.get("reviews"),
            location_text=item.get("location_rating", "") or item.get("description", ""),
            latitude=gps.get("latitude"),
            longitude=gps.get("longitude"),
            room_type=item.get("type", ""),
            cancellation_policy="",
            amenities=amenities,
            raw={**item, "fees_unclear": fees_unclear},
        )
