import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CityConfig, DateWindow, Evidence, Listing } from "../models.js";
import type { SourceAdapter } from "./base.js";

interface WebSearchOutput {
  listings?: WebSearchListing[];
}

interface WebSearchListing {
  source_listing_id?: string;
  name: string;
  url: string;
  city: string;
  neighborhood?: string;
  location_text?: string;
  latitude?: number;
  longitude?: number;
  room_type?: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_price_eur: number;
  nightly_price_eur: number;
  rating?: number | null;
  rating_scale?: number;
  review_count?: number | null;
  cancellation_policy?: string;
  source_reliability?: number;
  amenities: Record<string, Omit<Evidence, "source">>;
  transit?: Evidence;
  evidence_urls?: string[];
  evidence_notes?: string[];
  fees_unclear?: boolean;
  taxes_and_fees_included?: boolean;
}

export interface WebSearchCliOptions {
  live?: boolean;
  cachePath?: string;
  command?: string;
  timeoutMs?: number;
  cityLimit?: number;
  windowsPerCity?: number;
  model?: string;
  reasoningEffort?: string;
}

export class WebSearchCliSource implements SourceAdapter {
  readonly name = "websearch_cli";

  constructor(private readonly options: WebSearchCliOptions = {}) {}

  async search(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]> {
    const cached = await this.readCache(cities, windows);
    const live = this.options.live ?? process.env.ENABLE_CODEX_WEBSEARCH === "1";
    if (!live) return cached;

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "travel-websearch-"));
    const schemaPath = path.join(tempDir, "websearch-schema.json");
    try {
      await writeFile(schemaPath, JSON.stringify(outputSchema(), null, 2), "utf8");
      const timeout = this.options.timeoutMs ?? Number(process.env.WEBSEARCH_CLI_TIMEOUT_MS ?? 300000);
      const selectedCities = cities.slice(
        0,
        this.options.cityLimit ?? Number(process.env.WEBSEARCH_CITY_LIMIT ?? cities.length)
      );
      const outputs: WebSearchOutput[] = [];
      for (const city of selectedCities) {
        const outputPath = path.join(tempDir, `websearch-output-${city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
        const prompt = buildPrompt(city, windows, this.options.windowsPerCity);
        await runCodexCli(
          this.options.command ?? process.env.CODEX_CLI_PATH ?? "codex",
          [
            "--search",
            "-c",
            `model_reasoning_effort="${this.options.reasoningEffort ?? process.env.WEBSEARCH_CODEX_REASONING_EFFORT ?? "low"}"`,
            ...(this.options.model ?? process.env.WEBSEARCH_CODEX_MODEL
              ? ["-m", this.options.model ?? process.env.WEBSEARCH_CODEX_MODEL ?? ""]
              : []),
            "exec",
            "--skip-git-repo-check",
            "--sandbox",
            "danger-full-access",
            "--cd",
            process.cwd(),
            "--output-schema",
            schemaPath,
            "--output-last-message",
            outputPath,
            "-"
          ],
          prompt,
          timeout
        );
        outputs.push(JSON.parse(await readFile(outputPath, "utf8")) as WebSearchOutput);
      }

      const merged = { listings: outputs.flatMap((output) => output.listings ?? []) };
      await this.writeCache(merged);
      return this.normalize(merged, cities, windows);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async readCache(cities: CityConfig[], windows: DateWindow[]): Promise<Listing[]> {
    const cachePath = this.options.cachePath ?? process.env.WEBSEARCH_CACHE_PATH ?? "data/websearch_cli_results.json";
    try {
      return this.normalize(JSON.parse(await readFile(cachePath, "utf8")) as WebSearchOutput, cities, windows);
    } catch {
      return [];
    }
  }

  private async writeCache(data: WebSearchOutput): Promise<void> {
    const cachePath = this.options.cachePath ?? process.env.WEBSEARCH_CACHE_PATH ?? "data/websearch_cli_results.json";
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  private normalize(data: WebSearchOutput, cities: CityConfig[], windows: DateWindow[]): Listing[] {
    const cityNames = new Set(cities.map((city) => city.name.toLowerCase()));
    const allowedNights = new Set(windows.map((window) => window.nights));
    const sortedCheckIns = windows.map((window) => window.checkIn).sort();
    const minCheckIn = sortedCheckIns[0] ?? "0000-00-00";
    const maxCheckIn = sortedCheckIns.at(-1) ?? "9999-99-99";

    return (data.listings ?? [])
      .filter((item) => cityNames.has(item.city.toLowerCase()))
      .filter((item) => allowedNights.has(item.nights))
      .filter((item) => item.check_in >= minCheckIn && item.check_in <= maxCheckIn)
      .map((item) => {
        const amenities: Record<string, Evidence> = {};
        for (const [key, value] of Object.entries(item.amenities)) {
          amenities[key] = { ...value, source: this.name };
        }
        return {
          source: this.name,
          sourceReliability: item.source_reliability ?? 0.68,
          sourceListingId: item.source_listing_id ?? stableWebSearchId(item),
          name: item.name,
          url: item.url,
          city: item.city,
          neighborhood: item.neighborhood ?? "Unknown",
          dates: {
            checkIn: item.check_in,
            checkOut: item.check_out,
            nights: item.nights,
            label: `${item.check_in} to ${item.check_out}`
          },
          totalPriceEur: item.total_price_eur,
          nightlyPriceEur: item.nightly_price_eur,
          rating: item.rating ?? null,
          ratingScale: item.rating_scale ?? 10,
          reviewCount: item.review_count ?? null,
          locationText: item.location_text ?? item.neighborhood ?? "",
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          roomType: item.room_type ?? "private accommodation",
          cancellationPolicy: item.cancellation_policy ?? "Not verified by websearch CLI.",
          amenities,
          transit: item.transit ?? {
            status: "ambiguous",
            detail: "Websearch result did not provide direct transit evidence.",
            source: this.name
          },
          raw: {
            ...item,
            fetched_at: new Date().toISOString().slice(0, 10),
            source_tool: "codex exec websearch CLI",
            pricing_note: "Preliminary price from web search/OTA result; verify checkout total before booking.",
            evidence_urls: item.evidence_urls ?? [item.url],
            qa_evidence: item.evidence_notes ?? [],
            fees_unclear: item.fees_unclear ?? true,
            taxes_and_fees_included: item.taxes_and_fees_included
          }
        };
      });
  }
}

function buildPrompt(city: CityConfig, windows: DateWindow[], configuredLimit?: number): string {
  const windowLimit = configuredLimit ?? Number(process.env.WEBSEARCH_WINDOWS_PER_CITY ?? 12);
  const windowSample = windows.slice(0, windowLimit).map((window) => `${window.checkIn} to ${window.checkOut} (${window.nights}n)`);
  return `Search the web for accommodation deal candidates in ${city.name}, ${city.country}.

Return ONLY JSON matching the provided schema.

Date windows to consider, use these exact dates when possible:
${windowSample.join("\n")}

Requirements:
- private short-stay accommodation, not dorm/shared room
- preliminary nightly price <= EUR 80, prefer <= EUR 35; EUR 50-80 is acceptable but should be high quality
- 2-6 nights
- rating >= 8/10 when available
- kitchen or kitchenette
- stovetop/hob
- kitchenware/cookware/dishes/cutlery/utensils
- individually guest-adjustable air conditioning/heating/climate where possible
- blackout curtains/shades/shutters are useful but may be marked missing/ambiguous
- public transport or central coordinates/location evidence

Run several different searches for this city. Include at least one non-Booking source if any plausible option exists: Hotels.com, Expedia, Vrbo, official property pages, aparthotel/property websites, Trip.com, Agoda, or other public web pages. Do not invent evidence. Mark each amenity confirmed, inferred, ambiguous, or missing with a source-backed detail.`;
}

function outputSchema(): Record<string, unknown> {
  const evidence = {
    type: "object",
    additionalProperties: false,
    required: ["status", "detail"],
    properties: {
      status: { enum: ["confirmed", "inferred", "ambiguous", "missing"] },
      detail: { type: "string" }
    }
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["listings"],
    properties: {
      listings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "source_listing_id",
            "url",
            "city",
            "neighborhood",
            "location_text",
            "latitude",
            "longitude",
            "room_type",
            "check_in",
            "check_out",
            "nights",
            "total_price_eur",
            "nightly_price_eur",
            "rating",
            "rating_scale",
            "review_count",
            "cancellation_policy",
            "source_reliability",
            "amenities",
            "transit",
            "evidence_urls",
            "evidence_notes",
            "fees_unclear",
            "taxes_and_fees_included"
          ],
          properties: {
            source_listing_id: { type: ["string", "null"] },
            name: { type: "string" },
            url: { type: "string" },
            city: { type: "string" },
            neighborhood: { type: ["string", "null"] },
            location_text: { type: ["string", "null"] },
            latitude: { type: ["number", "null"] },
            longitude: { type: ["number", "null"] },
            room_type: { type: ["string", "null"] },
            check_in: { type: "string" },
            check_out: { type: "string" },
            nights: { type: "number" },
            total_price_eur: { type: "number" },
            nightly_price_eur: { type: "number" },
            rating: { type: ["number", "null"] },
            rating_scale: { type: ["number", "null"] },
            review_count: { type: ["number", "null"] },
            cancellation_policy: { type: ["string", "null"] },
            source_reliability: { type: ["number", "null"] },
            amenities: {
              type: "object",
              additionalProperties: false,
              required: [
                "adjustable_climate_control",
                "kitchen_or_kitchenette",
                "stovetop",
                "utensils",
                "blackout_window_covering"
              ],
              properties: {
                adjustable_climate_control: evidence,
                kitchen_or_kitchenette: evidence,
                stovetop: evidence,
                utensils: evidence,
                blackout_window_covering: evidence
              }
            },
            transit: evidence,
            evidence_urls: { type: ["array", "null"], items: { type: "string" } },
            evidence_notes: { type: ["array", "null"], items: { type: "string" } },
            fees_unclear: { type: ["boolean", "null"] },
            taxes_and_fees_included: { type: ["boolean", "null"] }
          }
        }
      }
    }
  };
}

function stableWebSearchId(item: WebSearchListing): string {
  return [item.city, item.name, item.check_in, String(item.nights)].join("|").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function runCodexCli(command: string, args: string[], input: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`websearch_cli timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const output = Buffer.concat([...stdout, ...stderr]).toString("utf8").trim();
      reject(new Error(`websearch_cli exited with code ${code ?? "unknown"}${output ? `: ${output}` : ""}`));
    });
    child.stdin.end(input);
  });
}
