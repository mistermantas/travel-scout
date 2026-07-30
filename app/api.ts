import { createFallbackBootstrap } from "./data";
import type { BootstrapPayload, CheckPayload, TravelConfig } from "./types";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

export function apiBaseUrl(): string {
  return configuredBaseUrl;
}

export async function loadBootstrap(): Promise<{ payload: BootstrapPayload; cached: boolean }> {
  try {
    const payload = await request<BootstrapPayload>("/api/bootstrap", { timeoutMs: 10_000 });
    return { payload, cached: false };
  } catch {
    return { payload: createFallbackBootstrap(loadLocalConfig()), cached: true };
  }
}

export async function runCheck(config: TravelConfig, liveWebSearch: boolean): Promise<CheckPayload> {
  const payload = await request<{ check: CheckPayload }>("/api/check", {
    method: "POST",
    body: JSON.stringify({ config, live_web_search: liveWebSearch }),
    timeoutMs: liveWebSearch ? 300_000 : 30_000
  });
  return payload.check;
}

export async function saveServerConfig(config: TravelConfig): Promise<void> {
  await request("/api/config", {
    method: "POST",
    body: JSON.stringify({ config }),
    timeoutMs: 10_000
  });
}

export function loadLocalConfig(): TravelConfig | undefined {
  const raw = localStorage.getItem("travel-scout:config");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as TravelConfig;
  } catch {
    return undefined;
  }
}

export function saveLocalConfig(config: TravelConfig): void {
  localStorage.setItem("travel-scout:config", JSON.stringify(config));
}

async function request<T = unknown>(
  pathname: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const response = await fetch(`${configuredBaseUrl}${pathname}`, {
      ...options,
      headers: { "content-type": "application/json", ...options.headers },
      signal: controller.signal
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Request failed with ${response.status}.`);
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}
