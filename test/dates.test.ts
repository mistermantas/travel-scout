import assert from "node:assert/strict";
import test from "node:test";
import { generateDateWindows, parseDateOnly } from "../src/dates.js";

test("generateDateWindows respects horizon and stay lengths", () => {
  const windows = generateDateWindows(
    parseDateOnly("2026-07-04"),
    { startMonthsFromNow: 3, endMonthsFromNow: 3, stepDays: 21 },
    [2, 6]
  );

  assert.deepEqual(
    windows.map((window) => window.nights),
    [2, 6]
  );
  assert.equal(windows[0]?.checkIn, "2026-10-04");
  assert.equal(windows[1]?.checkOut, "2026-10-10");
});
