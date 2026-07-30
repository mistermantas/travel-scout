import type { CityConfig, DateWindow, Listing } from "../models.js";

export interface SourceAdapter {
  name: string;
  search(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]>;
}
