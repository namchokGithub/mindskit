import assert from "node:assert/strict";
import test from "node:test";

import { isFinderModule } from "../src/features/qr-code/render.ts";

test("custom body shapes leave all three QR finder patterns intact", () => {
  const count = 29;
  for (const [row, col] of [[0, 0], [6, 6], [0, 22], [6, 28], [22, 0], [28, 6]]) {
    assert.equal(isFinderModule(row, col, count), true);
  }
  for (const [row, col] of [[7, 0], [0, 7], [7, 28], [28, 7], [14, 14], [28, 28]]) {
    assert.equal(isFinderModule(row, col, count), false);
  }
});
