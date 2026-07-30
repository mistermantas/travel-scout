from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from .config import load_config
from .dates import generate_date_windows
from .filtering import evaluate_listing
from .report import write_json_report, write_markdown_report
from .sources.fixture import FixtureSource
from .sources.serpapi_google_hotels import SerpApiGoogleHotelsSource
from .store import SeenStore


def main() -> int:
    parser = argparse.ArgumentParser(description="Find and rank short-stay accommodation deal candidates.")
    parser.add_argument("--config", default="config.example.json")
    parser.add_argument("--out", default="reports")
    parser.add_argument("--fixture-path", default="data/fixture_listings.json")
    parser.add_argument("--today", default=None, help="Override today's date as YYYY-MM-DD for repeatable runs.")
    parser.add_argument("--no-write-state", action="store_true")
    args = parser.parse_args()

    config = load_config(args.config)
    today = date.fromisoformat(args.today) if args.today else date.today()
    windows = generate_date_windows(today, config.date_horizon, config.stay_lengths)
    included_cities = tuple(
        city for city in config.cities if city.name.lower() not in {name.lower() for name in config.excluded_cities}
    )
    sources = []
    if "fixture" in config.sources_enabled:
        sources.append(FixtureSource(Path(args.fixture_path)))
    if "serpapi_google_hotels" in config.sources_enabled:
        sources.append(SerpApiGoogleHotelsSource())

    store = SeenStore(config.state_path)
    raw_listings = []
    for source in sources:
        raw_listings.extend(source.search(list(included_cities), windows))

    results = [
        evaluate_listing(listing, config, is_new=store.is_new(listing.stable_key))
        for listing in raw_listings
    ]
    results.sort(key=lambda result: (result.accepted, result.score.total, result.score.confidence), reverse=True)
    top_results = results[: config.report_top_n]

    out = Path(args.out)
    write_json_report(top_results, out / "travel-deals.json")
    write_markdown_report(top_results, out / "travel-deals.md")

    if not args.no_write_state:
        store.mark_many([result.listing.stable_key for result in top_results if result.accepted])

    print(f"Wrote {len(top_results)} ranked candidates to {out / 'travel-deals.md'} and {out / 'travel-deals.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
