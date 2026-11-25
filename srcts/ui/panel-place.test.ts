// Whether the DAG's element holds its panel of advanced actions below the
// canvas, and how the canvas pans the panel's object into view above it
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#its-advanced-actions).

import { describe, expect, test } from "vitest";
import { hasRoom, LEAST_HEIGHT, PANEL_WIDTH, revealPan } from "./panel-place.ts";

const node = { left: 100, width: 40, height: 52 };

describe("the panel of advanced actions", () => {
  test("docks below the canvas where the element is as wide as every place of an advanced action and high enough", () => {
    expect(hasRoom({ width: 1200, height: 800 })).toBe(true);
    expect(hasRoom({ width: PANEL_WIDTH, height: LEAST_HEIGHT })).toBe(true);
    // A narrow panel of the dock, and a low element.
    expect(hasRoom({ width: PANEL_WIDTH - 1, height: 800 })).toBe(false);
    expect(hasRoom({ width: 1200, height: LEAST_HEIGHT - 1 })).toBe(false);
  });

  test("leaves the canvas where it is while the object lies within the canvas above the panel", () => {
    expect(revealPan({ ...node, top: 200 }, 500)).toBe(0);
  });

  test("pans the canvas up until the object lies 10 px above the panel, where the panel would hide it", () => {
    expect(revealPan({ ...node, top: 470 }, 500)).toBe(-32);
    expect(revealPan({ ...node, top: 600 }, 500)).toBe(-162);
  });

  test("pans the canvas down until the object lies 10 px below the canvas's top, where it lies above it", () => {
    expect(revealPan({ ...node, top: -30 }, 500)).toBe(40);
  });

  test("puts an object taller than the canvas holds at the canvas's top", () => {
    expect(revealPan({ ...node, top: 200, height: 600 }, 500)).toBe(-190);
  });
});
