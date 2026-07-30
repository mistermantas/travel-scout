from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal


EvidenceStatus = Literal["confirmed", "inferred", "ambiguous", "missing"]


@dataclass(frozen=True)
class Evidence:
    status: EvidenceStatus
    detail: str
    source: str = ""

    @property
    def confidence(self) -> float:
        return {
            "confirmed": 1.0,
            "inferred": 0.65,
            "ambiguous": 0.35,
            "missing": 0.0,
        }[self.status]


@dataclass(frozen=True)
class CityConfig:
    name: str
    country: str
    center: tuple[float, float] | None = None
    central_radius_km: float = 4.0
    accepted_transit_modes: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class DateWindow:
    check_in: date
    check_out: date
    nights: int

    @property
    def label(self) -> str:
        return f"{self.check_in.isoformat()} to {self.check_out.isoformat()}"


@dataclass
class Listing:
    source: str
    source_reliability: float
    source_listing_id: str
    name: str
    url: str
    city: str
    neighborhood: str
    dates: DateWindow
    total_price_eur: float
    nightly_price_eur: float
    rating: float | None
    rating_scale: float
    review_count: int | None
    location_text: str = ""
    latitude: float | None = None
    longitude: float | None = None
    room_type: str = ""
    cancellation_policy: str = ""
    amenities: dict[str, Evidence] = field(default_factory=dict)
    transit: Evidence = field(default_factory=lambda: Evidence("missing", "No transit evidence."))
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def stable_key(self) -> str:
        return "|".join(
            [
                self.source.lower(),
                self.city.lower(),
                self.source_listing_id.lower(),
                self.dates.check_in.isoformat(),
                str(self.dates.nights),
            ]
        )


@dataclass(frozen=True)
class ScoreBreakdown:
    price: float
    rating: float
    review_confidence: float
    amenity_match: float
    transit: float
    stay_length: float
    cancellation: float
    source_reliability: float
    amenity_uncertainty_penalty: float
    unclear_fee_penalty: float
    risk_penalty: float
    penalties: float
    total: float
    confidence: float


@dataclass(frozen=True)
class DealResult:
    listing: Listing
    score: ScoreBreakdown
    accepted: bool
    reasons: tuple[str, ...]
    manual_verification: tuple[str, ...]
    is_new: bool = True
