from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import CityConfig


@dataclass(frozen=True)
class DateHorizon:
    start_months_from_now: int
    end_months_from_now: int
    step_days: int


@dataclass(frozen=True)
class MinimumRating:
    ten_point: float
    five_point: float


@dataclass(frozen=True)
class AcceptableTransit:
    min_confidence: float
    reasonable_commute_minutes: int


@dataclass(frozen=True)
class AppConfig:
    cities: tuple[CityConfig, ...]
    excluded_cities: tuple[str, ...]
    max_nightly_price_eur: float
    preferred_nightly_price_eur: float
    stay_lengths: tuple[int, ...]
    date_horizon: DateHorizon
    minimum_rating: MinimumRating
    minimum_review_count: int
    required_amenities: tuple[str, ...]
    acceptable_transit: AcceptableTransit
    sources_enabled: tuple[str, ...]
    allow_shared_rooms: bool
    min_value_score_for_over_preferred_price: float
    report_top_n: int
    state_path: Path


def load_config(path: str | Path) -> AppConfig:
    config_path = Path(path)
    data: dict[str, Any] = json.loads(config_path.read_text(encoding="utf-8"))
    cities = []
    for item in data["cities"]:
        center = item.get("center")
        cities.append(
            CityConfig(
                name=item["name"],
                country=item.get("country", ""),
                center=tuple(center) if center else None,
                central_radius_km=float(item.get("central_radius_km", 4.0)),
                accepted_transit_modes=tuple(item.get("accepted_transit_modes", [])),
                aliases=tuple(item.get("aliases", [])),
            )
        )

    return AppConfig(
        cities=tuple(cities),
        excluded_cities=tuple(data.get("excluded_cities", [])),
        max_nightly_price_eur=float(data["max_nightly_price_eur"]),
        preferred_nightly_price_eur=float(data["preferred_nightly_price_eur"]),
        stay_lengths=tuple(int(value) for value in data["stay_lengths"]),
        date_horizon=DateHorizon(**data["date_horizon"]),
        minimum_rating=MinimumRating(**data["minimum_rating"]),
        minimum_review_count=int(data["minimum_review_count"]),
        required_amenities=tuple(data["required_amenities"]),
        acceptable_transit=AcceptableTransit(**data["acceptable_transit"]),
        sources_enabled=tuple(data.get("sources_enabled", ["fixture"])),
        allow_shared_rooms=bool(data.get("allow_shared_rooms", False)),
        min_value_score_for_over_preferred_price=float(data.get("min_value_score_for_over_preferred_price", 70)),
        report_top_n=int(data.get("report_top_n", 20)),
        state_path=(config_path.parent / data.get("state_path", "data/seen_results.json")).resolve(),
    )
