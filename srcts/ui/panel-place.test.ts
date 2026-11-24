// Where the DAG's panel of advanced actions goes beside its object
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#its-advanced-actions).

import { describe, expect, test } from "vitest";
import { hasRoom, PANEL_WIDTH, panelPlace } from "./panel-place.ts";

const frame = { width: 1200, height: 800 };
const node = { width: 40, height: 52 };

describe("the panel of advanced actions", () => {
  test("goes to the right of its object, level with its top, where the element has room there", () => {
    expect(panelPlace({ ...node, left: 100, top: 200 }, frame)).toEqual({ left: 148, top: 200, height: 590, pan: { x: 0, y: 0 } });
  });

  test("goes to the left of its object where only that side has room", () => {
    const place = panelPlace({ ...node, left: 900, top: 200 }, frame);
    expect(place?.left).toBe(900 - 8 - PANEL_WIDTH);
    expect(place?.pan).toEqual({ x: 0, y: 0 });
  });

  test("goes to the element's right edge, and pans its object to the left of it, where neither side has room", () => {
    const narrow = { width: 560, height: 800 };
    const place = panelPlace({ ...node, left: 300, top: 200 }, narrow);
    expect(place?.left).toBe(560 - 10 - PANEL_WIDTH);
    // The object's right edge ends one gap before the panel.
    expect(300 + 40 + (place?.pan.x ?? 0)).toBe(130 - 8);
  });

  test("pans an object that lies below the element into view, and keeps a height of its own", () => {
    const place = panelPlace({ ...node, left: 100, top: 900 }, frame);
    expect(place?.pan.y).toBe(800 - 10 - 952);
    expect(place?.top).toBe(800 - 10 - 240);
    expect(place?.height).toBe(240);
  });

  test("has no place in an element too narrow to hold its object and the panel side by side", () => {
    expect(hasRoom(node, { width: 480 })).toBe(false);
    expect(panelPlace({ ...node, left: 10, top: 10 }, { width: 480, height: 800 })).toBeUndefined();
    expect(hasRoom(node, { width: 10 + 40 + 8 + PANEL_WIDTH + 10 })).toBe(true);
  });
});
