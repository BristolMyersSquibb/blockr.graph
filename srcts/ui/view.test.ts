// The view that fits the board, and the zoom and the pan that the DAG keeps
// for the page (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-canvas).

import { describe, expect, test } from "vitest";
import { canvasOf } from "../geometry/index.ts";
import type { GraphState } from "../state/index.ts";
import { boardOf, stateOf } from "../testing/index.ts";
import { FIT_ZOOM, fittedView, savedView, saveView } from "./view.ts";

function canvas(positions: GraphState["positions"]) {
  const board = boardOf({ blocks: { a: "A", b: "B" }, state: { positions } });
  return canvasOf(board, stateOf(board));
}

describe("the fitted view", () => {
  test("is none where nothing has a position, or the canvas has no size", () => {
    expect(fittedView(canvas({}), { width: 800, height: 600 })).toBeUndefined();
    expect(fittedView(canvas({ a: { x: 0, y: 0 } }), { width: 0, height: 0 })).toBeUndefined();
  });

  test("zooms in no further than 100%, so that no block shows larger than its size", () => {
    expect(fittedView(canvas({ a: { x: 0, y: 0 } }), { width: 800, height: 600 })?.zoom).toBe(FIT_ZOOM);
  });

  test("zooms out until the whole board fits, with room for the toolbar on the left", () => {
    const view = fittedView(canvas({ a: { x: 0, y: 0 }, b: { x: 2000, y: 1000 } }), { width: 800, height: 600 });
    if (view === undefined) throw new Error("No view");
    expect(view.zoom).toBeLessThan(0.4);
    // The left edge of block a, 16 px left of its centre, sits right of the
    // toolbar, and the right edge of block b inside the canvas.
    expect(view.x + (0 - 16) * view.zoom).toBeGreaterThanOrEqual(50);
    expect(view.x + (2000 + 16) * view.zoom).toBeLessThanOrEqual(800);
  });
});

describe("the zoom and the pan", () => {
  test("are kept for the page by the board's id", () => {
    expect(savedView("view-test")).toBeUndefined();
    saveView("view-test", { x: 1, y: 2, zoom: 0.5 });
    expect(savedView("view-test")).toEqual({ x: 1, y: 2, zoom: 0.5 });
    expect(savedView("another")).toBeUndefined();
  });
});
