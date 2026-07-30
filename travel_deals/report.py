from __future__ import annotations

import json
from pathlib import Path

from .models import DealResult, Evidence


def result_to_dict(result: DealResult) -> dict:
    listing = result.listing
    return {
        "accepted": result.accepted,
        "is_new": result.is_new,
        "city": listing.city,
        "neighborhood": listing.neighborhood,
        "source": listing.source,
        "listing_name": listing.name,
        "url": listing.url,
        "dates_tested": listing.dates.label,
        "stay_length": listing.dates.nights,
        "total_price_eur": listing.total_price_eur,
        "nightly_equivalent_eur": listing.nightly_price_eur,
        "rating": listing.rating,
        "rating_scale": listing.rating_scale,
        "review_count": listing.review_count,
        "amenity_evidence": {
            key: {"status": evidence.status, "detail": evidence.detail, "source": evidence.source}
            for key, evidence in listing.amenities.items()
        },
        "transit_accessibility_evidence": {
            "status": listing.transit.status,
            "detail": listing.transit.detail,
            "source": listing.transit.source,
        },
        "confidence_score": result.score.confidence,
        "value_score": result.score.total,
        "score_breakdown": result.score.__dict__,
        "why": list(result.reasons),
        "manual_verification": list(result.manual_verification),
    }


def write_json_report(results: list[DealResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([result_to_dict(result) for result in results], indent=2, ensure_ascii=False), encoding="utf-8")


def write_markdown_report(results: list[DealResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# Travel Deal Candidates", ""]
    if not results:
        lines.append("No candidates matched the current configuration.")
    for index, result in enumerate(results, start=1):
        listing = result.listing
        status = "accepted" if result.accepted else "rejected"
        lines.extend(
            [
                f"## {index}. {listing.name} ({status})",
                "",
                f"- City: {listing.city}",
                f"- Neighborhood/area: {listing.neighborhood or 'Unknown'}",
                f"- Source: {listing.source}",
                f"- URL: {listing.url or 'No direct URL provided by adapter'}",
                f"- Dates tested: {listing.dates.label}",
                f"- Stay length: {listing.dates.nights} nights",
                f"- Total price: EUR {listing.total_price_eur:.2f}",
                f"- Nightly equivalent: EUR {listing.nightly_price_eur:.2f}",
                f"- Rating and review count: {_rating_label(listing.rating, listing.rating_scale, listing.review_count)}",
                f"- Transit accessibility evidence: {listing.transit.status} - {listing.transit.detail}",
                f"- Confidence score: {result.score.confidence:.2f}",
                f"- Value score: {result.score.total:.2f}",
                "",
                "Amenity evidence:",
            ]
        )
        for key in [
            "adjustable_climate_control",
            "kitchen_or_kitchenette",
            "stovetop",
            "utensils",
            "blackout_window_covering",
        ]:
            evidence = listing.amenities.get(key, Evidence("missing", "No evidence available."))
            lines.append(f"- {key.replace('_', ' ')}: {evidence.status} - {evidence.detail}")

        lines.extend(["", "Why it is a good deal / why rejected:"])
        lines.extend(f"- {reason}" for reason in result.reasons)
        lines.extend(["", "Manual verification before booking:"])
        lines.extend(f"- {item}" for item in result.manual_verification)
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def _rating_label(rating: float | None, scale: float, review_count: int | None) -> str:
    rating_part = "unknown rating" if rating is None else f"{rating}/{scale:g}"
    review_part = "unknown reviews" if review_count is None else f"{review_count} reviews"
    return f"{rating_part}, {review_part}"
