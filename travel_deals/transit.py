from __future__ import annotations

import math
import re

from .models import CityConfig, Evidence, Listing


def haversine_km(first: tuple[float, float], second: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, first)
    lat2, lon2 = map(math.radians, second)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def estimate_transit_accessibility(listing: Listing, city: CityConfig) -> Evidence:
    text = " ".join(
        [
            listing.location_text,
            listing.neighborhood,
            " ".join(str(value) for value in listing.raw.get("nearby_places", [])),
        ]
    )
    lower = text.lower()
    modes = [mode.lower() for mode in city.accepted_transit_modes]
    mode_pattern = "|".join(re.escape(mode) for mode in modes)
    station_terms = ["station", "metro", "tram", "u-bahn", "s-bahn", "rail", "train", "subway"]

    if listing.latitude is not None and listing.longitude is not None and city.center is not None:
        distance = haversine_km(city.center, (listing.latitude, listing.longitude))
        if distance <= city.central_radius_km:
            return Evidence(
                "confirmed",
                f"{distance:.1f} km from the city center; central enough for the configured city radius.",
                "coordinates",
            )

    if mode_pattern and re.search(mode_pattern, lower):
        matched = next((mode for mode in city.accepted_transit_modes if mode.lower() in lower), "public transport")
        return Evidence("confirmed", f"Location text mentions accepted transit mode: {matched}.", "location text")

    if any(term in lower for term in station_terms):
        return Evidence("inferred", "Location text mentions a station or rail/metro/tram access.", "location text")

    if listing.location_text or listing.neighborhood:
        return Evidence(
            "ambiguous",
            "Area is named, but no explicit central-distance or public-transport evidence was available.",
            "location text",
        )

    return Evidence("missing", "No location or transit evidence was available.", "source")
