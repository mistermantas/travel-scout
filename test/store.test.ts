import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SeenStore } from "../src/store.js";

test("SeenStore persists seen result keys", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "travel-store-"));
  const storePath = path.join(temp, "seen.json");
  try {
    const first = new SeenStore(storePath);
    await first.load();
    assert.equal(first.isNew("abc"), true);
    await first.markMany(["abc"]);

    const second = new SeenStore(storePath);
    await second.load();
    assert.equal(second.isNew("abc"), false);
    assert.equal(second.isNew("def"), true);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
