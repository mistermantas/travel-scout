from __future__ import annotations

from .config import AppConfig
from .models import Evidence, Listing, ScoreBreakdown


AMENITY_WEIGHTS = {
    "adjustable_climate_control": 0.24,
    "kitchen_or_kitchenette": 0.23,
    "stovetop": 0.2,
    "utensils": 0.15,
    "blackout_window_covering": 0.18,
}


def price_score(nightly: float, preferred: float, maximum: float) -> float:
    if nightly <= preferred:
        return 1.0
    if nightly >= maximum:
        return 0.0
    return max(0.0, 1 - ((nightly - preferred) / (maximum - preferred)))


def rating_score(rating: float | None, scale: float, minimum: float) -> float:
    if rating is None:
        return 0.0
    normalized = (rating / scale) * 10
    if normalized < minimum:
        return max(0.0, normalized / minimum * 0.55)
    return min(1.0, 0.7 + ((normalized - minimum) / (10 - minimum)) * 0.3)


def review_confidence(review_count: int | None, minimum: int) -> float:
    if not review_count:
        return 0.0
    if review_count >= minimum * 4:
        return 1.0
    return min(1.0, review_count / (minimum * 4))


def amenity_match(amenities: dict[str, Evidence], required: tuple[str, ...]) -> float:
    if not required:
        return 1.0
    weighted_total = 0.0
    weight_seen = 0.0
    fallback_weight = 1 / len(required)
    for amenity in required:
        weight = AMENITY_WEIGHTS.get(amenity, fallback_weight)
        weight_seen += weight
        weighted_total += amenities.get(amenity, Evidence("missing", "Missing")).confidence * weight
    return weighted_total / weight_seen


def amenity_uncertainty_penalty(listing: Listing, config: AppConfig) -> float:
    penalty = 0.0
    for amenity in config.required_amenities:
        status = listing.amenities.get(amenity, Evidence("missing", "Missing")).status
        if status == "missing":
            penalty += 0.04
        elif status == "ambiguous":
            penalty += 0.025
        elif status == "inferred":
            penalty += 0.015
    return penalty


def cancellation_score(policy: str) -> float:
    lower = policy.lower()
    if not lower:
        return 0.35
    if "free cancellation" in lower or "refundable" in lower:
        return 1.0
    if "partial" in lower:
        return 0.65
    if "non-refundable" in lower or "non refundable" in lower:
        return 0.15
    return 0.45


def unclear_fee_penalty(listing: Listing) -> float:
    penalty = 0.0
    if listing.raw.get("fees_unclear") is True:
        penalty += 0.08
    if listing.raw.get("taxes_and_fees_included") is False:
        penalty += 0.05
    return penalty


def risk_penalty(listing: Listing, config: AppConfig) -> float:
    penalty = 0.0
    if listing.nightly_price_eur <= config.preferred_nightly_price_eur * 0.45:
        penalty += 0.08
    if not listing.review_count or listing.review_count < max(5, config.minimum_review_count // 3):
        penalty += 0.08
    if listing.total_price_eur <= 0 or listing.nightly_price_eur <= 0:
        penalty += 0.3
    return penalty


def score_listing(listing: Listing, config: AppConfig) -> ScoreBreakdown:
    minimum_rating = config.minimum_rating.ten_point if listing.rating_scale == 10 else config.minimum_rating.five_point
    if listing.rating_scale == 5:
        rating_component = rating_score(listing.rating, 5, minimum_rating * 2)
    else:
        rating_component = rating_score(listing.rating, listing.rating_scale, minimum_rating)

    price_component = price_score(
        listing.nightly_price_eur,
        config.preferred_nightly_price_eur,
        config.max_nightly_price_eur,
    )
    reviews_component = review_confidence(listing.review_count, config.minimum_review_count)
    amenities_component = amenity_match(listing.amenities, config.required_amenities)
    transit_component = listing.transit.confidence
    cancellation_component = cancellation_score(listing.cancellation_policy)
    stay_length_component = 1.0 if listing.dates.nights in config.stay_lengths else 0.0
    source_component = max(0.0, min(1.0, listing.source_reliability))
    amenity_penalty = amenity_uncertainty_penalty(listing, config)
    fee_penalty = unclear_fee_penalty(listing)
    listing_risk_penalty = risk_penalty(listing, config)
    penalties = amenity_penalty + fee_penalty + listing_risk_penalty

    total = (
        price_component * 28
        + rating_component * 14
        + reviews_component * 10
        + amenities_component * 20
        + transit_component * 10
        + stay_length_component * 6
        + cancellation_component * 5
        + source_component * 7
        - penalties * 100
    )
    total = max(0.0, min(100.0, total))
    confidence = (
        amenities_component * 0.34
        + transit_component * 0.18
        + reviews_component * 0.18
        + source_component * 0.2
        + cancellation_component * 0.1
    )

    return ScoreBreakdown(
        price=price_component,
        rating=rating_component,
        review_confidence=reviews_component,
        amenity_match=amenities_component,
        transit=transit_component,
        stay_length=stay_length_component,
        cancellation=cancellation_component,
        source_reliability=source_component,
        amenity_uncertainty_penalty=round(amenity_penalty, 3),
        unclear_fee_penalty=round(fee_penalty, 3),
        risk_penalty=round(listing_risk_penalty, 3),
        penalties=round(penalties, 3),
        total=round(total, 2),
        confidence=round(confidence, 2),
    )
