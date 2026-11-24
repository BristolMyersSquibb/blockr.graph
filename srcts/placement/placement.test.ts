// Where what a step adds starts, by the links of the board that the step
// leaves, and how Repulsion and Beside fit it in
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
// The boards here are laid out from top to bottom with the normal spacing,
// whose gap is 70 px, and every block's name is one letter, so every node is
// the mark's 32 px across and 52 px tall with its name.

import type { BlockId, StackId } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { canvasNodes, canvasOf, changed, STACK_WIDTH } from "../geometry/index.ts";
import type { Point } from "../state/index.ts";
import { boardOf, stateOf } from "../testing/index.ts";
import type { BoardSpec } from "../testing/index.ts";
import { linkOrder, placeAdded, startPoints, wayOf } from "./index.ts";

const GAP = 70;
// From one rank to the next: a node's height and the gap.
const RANK = 52 + GAP;
// From one node to the next in a rank: a node's width and the gap.
const NEXT = 32 + GAP;

// Where the blocks and stacks added to the board start, the board giving the
// positions of the others.
function starts(spec: BoardSpec, blocks: readonly BlockId[], stacks: readonly StackId[] = []) {
  const board = boardOf(spec);
  return startPoints(canvasOf(board, stateOf(board)), { blocks: new Set(blocks), stacks: new Set(stacks) }, stateOf(board).layout);
}

const at = (x: number, y: number): Point => ({ x, y });

describe("where an added block starts", () => {
  test("one gap past the other blocks that its source feeds, level with the rightmost", () => {
    const start = starts({ blocks: { a: "A", b: "B", n: "N" }, links: [["a", "b"], ["a", "n"]], state: { positions: { a: at(0, 0), b: at(0, RANK) } } }, ["n"]);
    expect(start.positions.n).toEqual(at(NEXT, RANK));
  });

  test("one rank past its sources where they feed no other block, in the way that the links into them run", () => {
    const below = starts({ blocks: { x: "X", a: "A", n: "N" }, links: [["x", "a"], ["a", "n"]], state: { positions: { x: at(0, 0), a: at(0, RANK) } } }, ["n"]);
    expect(below.positions.n).toEqual(at(0, 2 * RANK));
    // The user dragged a to the right of x, which feeds it, so the block
    // appended to a starts to the right of a, on a board laid out from top
    // to bottom.
    const right = starts({ blocks: { x: "X", a: "A", n: "N" }, links: [["x", "a"], ["a", "n"]], state: { positions: { x: at(0, 0), a: at(300, 0) } } }, ["n"]);
    expect(right.positions.n).toEqual(at(300 + NEXT, 0));
  });

  test("by the layout's direction where no link runs into its sources", () => {
    const start = starts({ blocks: { a: "A", n: "N" }, links: [["a", "n"]], state: { positions: { a: at(0, 0) } } }, ["n"]);
    expect(start.positions.n).toEqual(at(0, RANK));
    const across = starts(
      { blocks: { a: "A", n: "N" }, links: [["a", "n"]], state: { positions: { a: at(0, 0) }, layout: { ...stateOf(boardOf({ blocks: {} })).layout, direction: "LR" } } },
      ["n"],
    );
    expect(across.positions.n).toEqual(at(NEXT, 0));
  });

  test("between the two blocks of the link that it is inserted into", () => {
    const start = starts({ blocks: { a: "A", b: "B", n: "N" }, links: [["a", "n"], ["n", "b"]], state: { positions: { a: at(0, 0), b: at(40, 2 * RANK) } } }, ["n"]);
    expect(start.positions.n).toEqual(at(20, RANK));
  });

  test("upstream, beside the other blocks that feed the blocks it feeds, or one rank before them", () => {
    const beside = starts({ blocks: { c: "C", b: "B", n: "N" }, links: [["c", "b"], ["n", "b"]], state: { positions: { c: at(0, 0), b: at(0, RANK) } } }, ["n"]);
    expect(beside.positions.n).toEqual(at(NEXT, 0));
    const before = starts({ blocks: { b: "B", d: "D", n: "N" }, links: [["b", "d"], ["n", "b"]], state: { positions: { b: at(0, RANK), d: at(0, 2 * RANK) } } }, ["n"]);
    expect(before.positions.n).toEqual(at(0, 0));
  });

  test("after the last block of the first rank where it is linked to none", () => {
    const start = starts({ blocks: { a: "A", b: "B", c: "C", n: "N" }, state: { positions: { a: at(0, 0), b: at(200, 10), c: at(500, RANK) } } }, ["n"]);
    expect(start.positions.n).toEqual(at(200 + NEXT, 0));
    expect(starts({ blocks: { n: "N" } }, ["n"]).positions.n).toEqual(at(0, 0));
  });

  test("in the order of the links of what a step adds, so that a new chain comes out as a chain", () => {
    const spec = { blocks: { a: "A", n2: "N", n1: "N" }, links: [["n1", "n2"], ["a", "n1"]], state: { positions: { a: at(0, 0) } } } satisfies BoardSpec;
    expect(linkOrder(boardOf(spec), new Set(["n2", "n1"]))).toEqual(["n1", "n2"]);
    const start = starts(spec, ["n2", "n1"]);
    expect(start.positions).toEqual({ n1: at(0, RANK), n2: at(0, 2 * RANK) });
  });

  test("against the blocks that start before it, and off those that it would overlap", () => {
    const start = starts({ blocks: { a: "A", n1: "N", n2: "N" }, links: [["a", "n1"], ["a", "n2"]], state: { positions: { a: at(0, 0) } } }, ["n1", "n2"]);
    expect(start.positions).toEqual({ n1: at(0, RANK), n2: at(NEXT, RANK) });
  });

  test("off a block that the step puts where it would start", () => {
    const spec = { blocks: { a: "A", n1: "N", n2: "N" }, links: [["a", "n2"]], state: { positions: { a: at(0, 0), n1: at(0, RANK) } } } satisfies BoardSpec;
    expect(starts(spec, ["n1", "n2"]).positions).toEqual({ n2: at(NEXT, RANK) });
    const layout = { ...stateOf(boardOf(spec)).layout, direction: "LR" } as const;
    const across = starts({ ...spec, state: { positions: { a: at(0, 0), n1: at(NEXT, 0) }, layout } }, ["n1", "n2"]);
    expect(across.positions).toEqual({ n2: at(NEXT, RANK) });
  });

  test("below the last node of the first rank where the board runs from left to right", () => {
    const layout = { ...stateOf(boardOf({ blocks: {} })).layout, direction: "LR" } as const;
    const start = starts({ blocks: { a: "A", b: "B", c: "C", n: "N" }, state: { positions: { a: at(0, 0), b: at(10, 200), c: at(300, 0) }, layout } }, ["n"]);
    expect(start.positions.n).toEqual(at(0, 200 + RANK));
  });

  test("where the step puts it, with the others that the step adds against it", () => {
    const start = starts({ blocks: { a: "A", n: "N", m: "M" }, links: [["n", "m"]], state: { positions: { a: at(0, 0), n: at(400, 400) } } }, ["n", "m"]);
    expect(start.positions).toEqual({ m: at(400, 400 + RANK) });
  });

  test("for a stack that holds no block, as for a block linked to none, with its box's size", () => {
    const start = starts({ blocks: { a: "A" }, stacks: { s: [] }, state: { positions: { a: at(0, 0) } } }, [], ["s"]);
    // The box's middle is level with the middle of a's node, its position.
    expect(start.points.s).toEqual(at(16 + GAP + STACK_WIDTH / 2, 0));
  });
});

describe("the way that links run", () => {
  const board = boardOf({ blocks: { a: "A", b: "B", c: "C" }, links: [["a", "b"], ["a", "c"]] });
  const way = (positions: Record<string, Point>) => wayOf(canvasOf(board, { ...stateOf(board), positions }), Object.values(board.links), "TB", GAP);

  test("is the layout's direction's where the mean offset runs along it", () => {
    expect(way({ a: at(0, 0), b: at(-300, RANK), c: at(300, RANK) })).toEqual({ axis: "y", sign: 1 });
    expect(way({ a: at(0, RANK), b: at(-300, 0), c: at(300, 0) })).toEqual({ axis: "y", sign: -1 });
  });

  test("is the other axis where the mean offset along the direction is less than half a rank", () => {
    expect(way({ a: at(0, 0), b: at(-200, 10), c: at(-300, 0) })).toEqual({ axis: "x", sign: -1 });
  });

  test("goes the layout's direction's way where links run opposite ways", () => {
    expect(way({ a: at(0, 0), b: at(0, RANK), c: at(0, -RANK) })).toEqual({ axis: "x", sign: 1 });
    expect(wayOf(canvasOf(board, stateOf(board)), [], "LR", GAP)).toEqual({ axis: "x", sign: 1 });
  });
});

describe("fitting in what a step adds", () => {
  // Block b sits 30 px below where block n, appended to a, starts, and block
  // c sits the gap below b.
  const spec = {
    blocks: { a: "A", b: "B", c: "C", n: "N" },
    links: [["a", "n"]],
    state: { positions: { a: at(0, 0), b: at(0, RANK + 30), c: at(0, 2 * RANK + 30) } },
  } satisfies BoardSpec;

  test("under Repulsion keeps it where it starts, and moves what lies in its way", () => {
    const board = boardOf(spec);
    const canvas = canvasOf(board, stateOf(board));
    const placed = placeAdded(canvas, { blocks: new Set(["n"]), stacks: new Set() }, new Set(), stateOf(board).layout);
    expect(placed.positions.n).toEqual(at(0, RANK));
    expect(placed.positions.a).toBeUndefined();
    const after = changed(canvas, placed);
    const nodes = canvasNodes(after).map((node) => node.box);
    for (const [i, box] of nodes.entries()) {
      for (const other of nodes.slice(i + 1)) expect(Math.max(Math.abs(box.x - other.x) - 32, Math.abs(box.y - other.y) - 52)).toBeGreaterThan(GAP - 1);
    }
    // The blocks lined up a gap apart in its way move on together.
    expect(placed.positions.c?.y).toBeGreaterThan(2 * RANK + 30);
  });

  test("under Beside moves it to the nearest free spot, and moves no other block", () => {
    const board = boardOf({ ...spec, state: { ...spec.state, layout: { ...stateOf(boardOf(spec)).layout, placement: "beside" } } });
    const placed = placeAdded(canvasOf(board, stateOf(board)), { blocks: new Set(["n"]), stacks: new Set() }, new Set(), stateOf(board).layout);
    expect(Object.keys(placed.positions)).toEqual(["n"]);
    expect(placed.positions.n).toEqual(at(-GAP * 2, RANK));
  });

  test("under Beside keeps how what the step adds sits", () => {
    const layout = { ...stateOf(boardOf(spec)).layout, placement: "beside" } as const;
    const board = boardOf({
      blocks: { a: "A", n: "N", m: "M" },
      state: { positions: { a: at(0, 0), n: at(10, 0), m: at(10, RANK) }, layout },
    });
    const placed = placeAdded(canvasOf(board, stateOf(board)), { blocks: new Set(["n", "m"]), stacks: new Set() }, new Set(), layout);
    const [n, m] = [placed.positions.n, placed.positions.m];
    expect((m?.x ?? 0) - (n?.x ?? 0)).toBe(0);
    expect((m?.y ?? 0) - (n?.y ?? 0)).toBe(RANK);
    expect(placed.positions.a).toBeUndefined();
  });

  test("snaps every position that it sets while snapping is on", () => {
    const layout = { ...stateOf(boardOf(spec)).layout, snap: true, snap_size: 25 };
    const board = boardOf({ ...spec, state: { ...spec.state, layout } });
    const placed = placeAdded(canvasOf(board, stateOf(board)), { blocks: new Set(["n"]), stacks: new Set() }, new Set(), layout);
    for (const point of Object.values(placed.positions)) {
      expect(point.x % 25).toBe(0);
      expect(point.y % 25).toBe(0);
    }
  });
});
