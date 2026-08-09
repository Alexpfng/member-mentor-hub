import test from "node:test";
import assert from "node:assert/strict";

import { getMemberTabsDockPosition } from "./member-tabs-docking.js";

test("keeps member tabs inline before reaching the scroll viewport top", () => {
  assert.equal(
    getMemberTabsDockPosition({
      anchorTop: 220,
      scrollTop: 100,
      scrollLeft: 300,
      scrollWidth: 900,
      height: 54,
    }),
    null,
  );
});

test("docks member tabs after reaching the scroll viewport top", () => {
  assert.deepEqual(
    getMemberTabsDockPosition({
      anchorTop: 99,
      scrollTop: 100,
      scrollLeft: 300,
      scrollWidth: 900,
      height: 54,
    }),
    { top: 100, left: 300, width: 900, height: 54 },
  );
});
