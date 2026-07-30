import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { runChecker, type CheckRun } from "./checker.js";
import { configToRaw, loadRawConfig, parseConfig, type RawConfig } from "./config.js";
import { parseDateOnly } from "./dates.js";
import { resultToDict } from "./report.js";

const SOURCE_CATALOG = [
  { id: "booking_snapshot", label: "Booking snapshot", kind: "snapshot" },
  { id: "websearch_cli", label: "Codex web search", kind: "cache + live" },
  { id: "apartment_candidate_snapshot", label: "Hotels / Expedia snapshot", kind: "snapshot" },
  { id: "accor_snapshot", label: "Accor snapshot", kind: "snapshot" },
  { id: "serpapi_google_hotels", label: "SerpAPI Google Hotels", kind: "API key" },
  { id: "fixture", label: "Synthetic fixture", kind: "demo" }
] as const;

export interface TravelServerOptions {
  rootDir?: string;
  defaultConfigPath?: string;
  localConfigPath?: string;
}

interface CheckRequest {
  config?: unknown;
  live_web_search?: boolean;
  today?: string;
}

export function createTravelServer(options: TravelServerOptions = {}): Server {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const defaultConfigPath = path.resolve(rootDir, options.defaultConfigPath ?? "config.example.json");
  const localConfigPath = path.resolve(rootDir, options.localConfigPath ?? "config.local.json");

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        sendEmpty(response, 204);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { ok: true, service: "travel-scout" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const defaultRaw = await loadRawConfig(defaultConfigPath);
        const { raw: activeRaw, isLocal } = await loadActiveRawConfig(defaultRaw, localConfigPath);
        const config = parseConfig(activeRaw, path.dirname(localConfigPath));
        const check = await runChecker(config, {
          rootDir,
          writeReports: false,
          writeState: false,
          webSearch: { live: false, cachePath: path.join(rootDir, "data/websearch_cli_results.json") }
        });
        sendJson(response, 200, {
          config: configToRaw(config, path.dirname(localConfigPath)),
          default_config: defaultRaw,
          using_local_config: isLocal,
          source_catalog: SOURCE_CATALOG,
          check: checkPayload(check)
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/check") {
        const body = (await readJsonBody(request)) as CheckRequest;
        const config = parseConfig(body.config, path.dirname(localConfigPath));
        const check = await runChecker(config, {
          rootDir,
          today: body.today ? parseDateOnly(body.today) : new Date(),
          outDir: "reports",
          writeReports: true,
          writeState: false,
          webSearch: {
            live: body.live_web_search === true,
            cachePath: path.join(rootDir, "data/websearch_cli_results.json")
          }
        });
        sendJson(response, 200, { check: checkPayload(check) });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/config") {
        const body = (await readJsonBody(request)) as { config?: unknown };
        const config = parseConfig(body.config, path.dirname(localConfigPath));
        const raw = configToRaw(config, path.dirname(localConfigPath));
        await mkdir(path.dirname(localConfigPath), { recursive: true });
        await writeFile(localConfigPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
        sendJson(response, 200, { ok: true, config: raw });
        return;
      }
      if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
        await serveApp(response, rootDir, url.pathname);
        return;
      }
      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /must|requires|invalid|unexpected|JSON/i.test(message) ? 400 : 500;
      sendJson(response, status, { error: message });
    }
  });
}

function checkPayload(check: CheckRun): Record<string, unknown> {
  return {
    generated_at: check.generatedAt,
    summary: check.summary,
    sources: check.sources,
    results: check.results.map(resultToDict)
  };
}

async function loadActiveRawConfig(
  defaultRaw: RawConfig,
  localConfigPath: string
): Promise<{ raw: RawConfig; isLocal: boolean }> {
  try {
    return { raw: await loadRawConfig(localConfigPath), isLocal: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { raw: defaultRaw, isLocal: false };
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body must be smaller than 1 MB.");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) throw new Error("Request body must contain JSON.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request body contains invalid JSON.");
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...corsHeaders()
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendEmpty(response: ServerResponse, status: number): void {
  response.writeHead(status, corsHeaders());
  response.end();
}

async function serveApp(response: ServerResponse, rootDir: string, pathname: string): Promise<void> {
  const webDir = path.join(rootDir, "web-dist");
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const requestedPath = path.resolve(webDir, relativePath);
  const safePath = requestedPath.startsWith(`${webDir}${path.sep}`) ? requestedPath : path.join(webDir, "index.html");
  const filePath = (await isFile(safePath)) ? safePath : path.join(webDir, "index.html");
  const data = await readFile(filePath);
  response.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": path.basename(filePath) === "index.html" ? "no-store" : "public, max-age=31536000, immutable"
  });
  response.end(data);
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff2": "font/woff2"
  }[extension] ?? "application/octet-stream";
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  };
}

function parseServerArgs(argv: string[]): { port: number; host: string } {
  let port = Number(process.env.PORT ?? 4173);
  let host = process.env.HOST ?? "127.0.0.1";
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--port") port = Number(argv[++index]);
    else if (token === "--host") host = String(argv[++index]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port must be between 1 and 65535.");
  return { port, host };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { port, host } = parseServerArgs(process.argv.slice(2));
    const server = createTravelServer();
    server.listen(port, host, () => {
      console.log(`Travel Scout is running at http://${host}:${port}`);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
