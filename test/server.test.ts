import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { createTravelServer } from "../src/server.js";

test("server exposes health, cached bootstrap, and config validation", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "travel-scout-server-"));
  const server = createTravelServer({
    rootDir: process.cwd(),
    localConfigPath: path.join(tempDir, "config.local.json")
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: "travel-scout" });

    const bootstrap = await fetch(`${baseUrl}/api/bootstrap`);
    assert.equal(bootstrap.status, 200);
    const payload = (await bootstrap.json()) as {
      config: { preferred_nightly_price_eur: number; price_penalty_threshold_eur: number; max_nightly_price_eur: number };
      check: { summary: { accepted: number }; results: unknown[] };
    };
    assert.equal(payload.config.preferred_nightly_price_eur, 35);
    assert.equal(payload.config.price_penalty_threshold_eur, 50);
    assert.equal(payload.config.max_nightly_price_eur, 80);
    assert(payload.check.summary.accepted > 0);
    assert(payload.check.results.length > 0);

    const saved = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: payload.config })
    });
    assert.equal(saved.status, 200);
    const savedConfig = JSON.parse(await readFile(path.join(tempDir, "config.local.json"), "utf8")) as {
      preferred_nightly_price_eur: number;
    };
    assert.equal(savedConfig.preferred_nightly_price_eur, 35);

    const invalid = await fetch(`${baseUrl}/api/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        config: {
          ...payload.config,
          price_penalty_threshold_eur: 90
        }
      })
    });
    assert.equal(invalid.status, 400);
    assert.match(JSON.stringify(await invalid.json()), /price_penalty_threshold_eur/);
  } finally {
    server.close();
    await once(server, "close");
    await rm(tempDir, { recursive: true, force: true });
  }
});
