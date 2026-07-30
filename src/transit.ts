import type { CityConfig } from "./models.js";
import type { Evidence, Listing } from "./models.js";

export function haversineKm(first: [number, number], second: [number, number]): number {
  const [lat1, lon1] = first.map(toRadians) as [number, number];
  const [lat2, lon2] = second.map(toRadians) as [number, number];
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function estimateTransitAccessibility(listing: Listing, city: CityConfig): Evidence {
  const nearbyPlaces = Array.isArray(listing.raw.nearby_places) ? listing.raw.nearby_places : [];
  const text = [listing.locationText, listing.neighborhood, ...nearbyPlaces.map(String)].join(" ");
  const lower = text.toLowerCase();

  if (listing.latitude !== null && listing.longitude !== null && city.center) {
    const distance = haversineKm(city.center, [listing.latitude, listing.longitude]);
    if (distance <= city.centralRadiusKm) {
      return {
        status: "confirmed",
        detail: `${distance.toFixed(1)} km from the city center; central enough for the configured city radius.`,
        source: "coordinates"
      };
    }
  }

  const matchedMode = city.acceptedTransitModes.find((mode) => lower.includes(mode.toLowerCase()));
  if (matchedMode) {
    return {
      status: "confirmed",
      detail: `Location text mentions accepted transit mode: ${matchedMode}.`,
      source: "location text"
    };
  }

  const stationTerms = ["station", "metro", "tram", "u-bahn", "s-bahn", "rail", "train", "subway"];
  if (stationTerms.some((term) => lower.includes(term))) {
    return {
      status: "inferred",
      detail: "Location text mentions a station or rail/metro/tram access.",
      source: "location text"
    };
  }

  if (listing.locationText || listing.neighborhood) {
    return {
      status: "ambiguous",
      detail: "Area is named, but no explicit central-distance or public-transport evidence was available.",
      source: "location text"
    };
  }

  return { status: "missing", detail: "No location or transit evidence was available.", source: "source" };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
