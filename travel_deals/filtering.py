from __future__ import annotations

from .config import AppConfig
from .models import DealResult, Evidence, Listing
from .scoring import score_listing


SHARED_ROOM_TERMS = ("dorm", "shared room", "bed in", "hostel bed")


def evaluate_listing(listing: Listing, config: AppConfig, is_new: bool = True) -> DealResult:
    reasons: list[str] = []
    manual: list[str] = []
    accepted = True

    if listing.city.lower() in {city.lower() for city in config.excluded_cities}:
        accepted = False
        reasons.append(f"{listing.city} is excluded by config.")

    if listing.nightly_price_eur > config.max_nightly_price_eur:
        accepted = False
        reasons.append(f"Nightly price EUR {listing.nightly_price_eur:.2f} is above the configured maximum.")
    elif listing.nightly_price_eur <= config.preferred_nightly_price_eur:
        reasons.append("Nightly price is inside the preferred band.")
    else:
        reasons.append("Nightly price is above the preferred band but inside the hard cap.")

    room_type = " ".join([listing.room_type, listing.name]).lower()
    if not config.allow_shared_rooms and any(term in room_type for term in SHARED_ROOM_TERMS):
        accepted = False
        reasons.append("Listing appears to be a dorm/shared-room option.")

    if listing.rating is None:
        manual.append("Confirm rating on the source page; the adapter did not receive it.")
    else:
        rating_on_ten = listing.rating * 2 if listing.rating_scale == 5 else listing.rating
        if rating_on_ten < config.minimum_rating.ten_point:
            accepted = False
            reasons.append(f"Rating {rating_on_ten:.1f}/10 is below the configured minimum.")

    if listing.review_count is None:
        manual.append("Confirm review count; the adapter did not receive it.")
    elif listing.review_count < config.minimum_review_count:
        reasons.append("Review count is thin, so confidence is reduced.")

    for amenity in config.required_amenities:
        evidence = listing.amenities.get(amenity, Evidence("missing", "No evidence available."))
        if evidence.status == "missing":
            accepted = False
            reasons.append(f"{amenity.replace('_', ' ')} is not evidenced.")
        elif evidence.status in {"ambiguous", "inferred"}:
            manual.append(f"Verify {amenity.replace('_', ' ')}: {evidence.detail}")

    if listing.transit.confidence < config.acceptable_transit.min_confidence:
        accepted = False
        reasons.append("Transit accessibility confidence is below the configured minimum.")
    elif listing.transit.status != "confirmed":
        manual.append(f"Verify public-transport access: {listing.transit.detail}")

    if listing.cancellation_policy:
        manual.append(f"Check cancellation terms still match: {listing.cancellation_policy}")
    else:
        manual.append("Check cancellation/refund terms; none were provided by the adapter.")

    if listing.nightly_price_eur <= config.preferred_nightly_price_eur * 0.45:
        manual.append("Suspiciously low price: verify taxes, fees, room type, and whether it is a private unit.")

    score = score_listing(listing, config)
    if (
        accepted
        and listing.nightly_price_eur > config.preferred_nightly_price_eur
        and score.total < config.min_value_score_for_over_preferred_price
    ):
        accepted = False
        reasons.append(
            "Nightly price is above the preferred band and the value score is not strong enough "
            f"({score.total:.2f} < {config.min_value_score_for_over_preferred_price:.2f})."
        )

    if score.unclear_fee_penalty > 0:
        manual.append("Verify whether taxes, cleaning fees, service fees, and city taxes are included in the total.")

    if accepted:
        reasons.append("Accepted as a candidate because hard filters passed; confidence still depends on evidence quality.")

    return DealResult(
        listing=listing,
        score=score,
        accepted=accepted,
        reasons=tuple(reasons),
        manual_verification=tuple(dict.fromkeys(manual)),
        is_new=is_new,
    )
