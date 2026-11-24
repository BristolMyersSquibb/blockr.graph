// The nominal sizes of the DAG's nodes, their boxes on the canvas, and
// snapping.

import { describe, expect, test } from "vitest";
import { boardOf, stateOf } from "../testing/index.ts";
import {
  BLOCK_HEIGHT,
  blockBox,
  blockWidth,
  bounds,
  canvasNodes,
  canvasOf,
  distance,
  expandedBox,
  MARK,
  nodeChanges,
  overlaps,
  shownBox,
  snapChanges,
  snapPoint,
  STACK_HEIGHT,
  STACK_PADDING,
  STACK_WIDTH,
} from "./index.ts";

describe("the nominal size of a block's node", () => {
  test("is the mark's for a short name, and the name's for a longer one, up to a cap", () => {
    expect(blockWidth("ab")).toBe(MARK);
    expect(blockWidth("Filter rows")).toBe(Math.round(11 * 6.2 + 10));
    expect(blockWidth("x".repeat(80))).toBe(160);
    expect(BLOCK_HEIGHT).toBe(52);
  });

  test("centres the node at the block's position", () => {
    expect(blockBox({ x: 100, y: 50 }, "Filter rows")).toEqual({ x: 100, y: 50, w: blockWidth("Filter rows"), h: BLOCK_HEIGHT });
  });
});

describe("boxes", () => {
  test("bounds hold every box, and none for no box", () => {
    expect(bounds([])).toBeUndefined();
    expect(bounds([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 30 }])).toEqual({ x: 10, y: 0, w: 30, h: 30 });
  });

  test("two boxes overlap within a gap where they come closer than it along both axes", () => {
    const [a, b] = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 30, y: 0, w: 10, h: 10 }];
    expect(distance(a, b)).toBe(20);
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, b, 20)).toBe(false);
    expect(overlaps(a, b, 21)).toBe(true);
  });
});

describe("the canvas", () => {
  const board = boardOf({
    blocks: { a: "A", b: "B", c: "C", d: "D" },
    stacks: { s1: ["a", "b"], s2: ["c"], s3: [] },
    state: {
      positions: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 300, y: 0 }, gone: { x: 0, y: 0 } },
      stacks: { s2: { collapsed: 1, moved: { positions: {}, stacks: {} } }, s3: { x: 500, y: 0 }, s9: { x: 0, y: 0 } },
    },
  });
  const canvas = canvasOf(board, stateOf(board));

  test("counts only the entries in stacks that fit the board's stacks", () => {
    expect([...canvas.collapsed]).toEqual(["s2"]);
    expect(canvas.points).toEqual({ s3: { x: 500, y: 0 } });
  });

  test("boxes a stack around its blocks, and a collapsed one or one without blocks at its size", () => {
    const box = expandedBox(canvas, "s1");
    expect(box?.w).toBe(100 + MARK + 2 * STACK_PADDING);
    expect(shownBox(canvas, "s1")).toEqual(box);
    expect(shownBox(canvas, "s2")).toMatchObject({ x: 300, w: STACK_WIDTH, h: STACK_HEIGHT });
    expect(shownBox(canvas, "s3")).toEqual({ x: 500, y: 0, w: STACK_WIDTH, h: STACK_HEIGHT });
    expect(expandedBox(canvas, "s3")).toBeUndefined();
  });

  test("shows each block with a position but those of collapsed stacks, then each stack shown as one box", () => {
    expect(canvasNodes(canvas).map((node) => `${node.kind}:${node.id}`)).toEqual(["block:a", "block:b", "stack:s2", "stack:s3"]);
  });

  test("moves a collapsed stack's blocks with it by one distance", () => {
    const node = canvasNodes(canvas).find((n) => n.id === "s2");
    if (node === undefined) throw new Error("no node");
    expect(nodeChanges(canvas, node, { ...node.box, x: node.box.x + 10, y: node.box.y + 5 })).toEqual({
      positions: { c: { x: 310, y: 5 } },
      points: {},
    });
  });

  test("moves an expanded stack's blocks with its box by one distance, and a stack without blocks alone", () => {
    const box = expandedBox(canvas, "s1");
    if (box === undefined) throw new Error("no box");
    const expanded = { kind: "stack", id: "s1", box, stack: "s1" } as const;
    expect(nodeChanges(canvas, expanded, { ...box, x: box.x + 10, y: box.y + 5 }).positions).toEqual({
      a: { x: 10, y: 5 },
      b: { x: 110, y: 5 },
    });
    const empty = canvasNodes(canvas).find((n) => n.id === "s3");
    if (empty === undefined) throw new Error("no node");
    expect(nodeChanges(canvas, empty, { ...empty.box, x: 510, y: 5 })).toEqual({ positions: {}, points: { s3: { x: 510, y: 5 } } });
  });
});

describe("snapping", () => {
  const layout = { direction: "TB", spacing: "normal", placement: "repulsion", snap: true, snap_size: 20 } as const;

  test("rounds a point to the nearest multiple of the snap size", () => {
    expect(snapPoint({ x: 29, y: -31 }, 20)).toEqual({ x: 20, y: -40 });
  });

  test("leaves what an operation sets as it is while snapping is off", () => {
    const board = boardOf({ blocks: { a: "A" } });
    const changes = { positions: { a: { x: 3, y: 7 } }, points: {} };
    expect(snapChanges(canvasOf(board, stateOf(board)), changes, { ...layout, snap: false })).toBe(changes);
  });

  test("moves a node on to the nearest multiple that keeps the gap, where rounding brings it too close", () => {
    // Block b sits right of block a, the gap of 70 px apart, and rounding its
    // x down would bring it 1 px closer.
    const width = blockWidth("A");
    const board = boardOf({ blocks: { a: "A", b: "A" }, state: { positions: { a: { x: 0, y: 0 } } } });
    const x = width + 70 + 1;
    const snapped = snapChanges(canvasOf(board, stateOf(board)), { positions: { b: { x, y: 0 } }, points: {} }, layout);
    expect(snapped.positions.b).toEqual({ x: 120, y: 0 });
    expect(x).toBeLessThan(110);
  });

  test("rounds only where the node sat closer than the gap already", () => {
    const board = boardOf({ blocks: { a: "A", b: "A" }, state: { positions: { a: { x: 0, y: 0 } } } });
    const snapped = snapChanges(canvasOf(board, stateOf(board)), { positions: { b: { x: 41, y: 2 } }, points: {} }, layout);
    expect(snapped.positions.b).toEqual({ x: 40, y: 0 });
  });
});
