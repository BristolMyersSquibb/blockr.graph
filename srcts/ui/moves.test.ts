// What dragging nodes and pressing the arrow keys move, and the batch that
// ends them (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures).

import { describe, expect, test } from "vitest";
import { canvasOf, expandedBox, shownBox } from "../geometry/index.ts";
import type { Canvas } from "../geometry/index.ts";
import { defaultState, GRAPH } from "../state/index.ts";
import type { GraphState, Layout } from "../state/index.ts";
import { boardOf } from "../testing/index.ts";
import { centreOf, dragMoves, joins, keyMoves, movedBy, movesBatch, NO_MOVES } from "./moves.ts";

const LAYOUT = defaultState.layout;
const SNAPPING: Layout = { ...LAYOUT, snap: true, snap_size: 20 };

// The blocks a and b in the stack s1, c and d in none, the stack s2 with no
// block, and the stack s3 with the block e, collapsed.
function canvas(): Canvas {
  const board = boardOf({
    blocks: { a: "A", b: "B", c: "C", d: "D", e: "E" },
    links: [
      ["a", "b"],
      ["b", "c"],
    ],
    stacks: { s1: ["a", "b"], s3: ["e"] },
    state: {
      positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 150 }, c: { x: 300, y: 150 }, d: { x: 600, y: 0 }, e: { x: 900, y: 0 } },
      stacks: { s2: { x: 600, y: 300 }, s3: { collapsed: 1, moved: { positions: {}, stacks: {} } } },
    },
  });
  const empty = { ...board, stacks: { ...board.stacks, s2: { name: "s2", blocks: [], color: null } } };
  return canvasOf(empty, empty.plugins[GRAPH] as GraphState);
}

describe("moving nodes", () => {
  test("moves a block to its new position, and a stack that holds no block to the new position of its box", () => {
    expect(movedBy(canvas(), ["b:c", "s:s2"], 7, -3, LAYOUT)).toEqual({
      positions: { c: { x: 307, y: 147 } },
      points: { s2: { x: 607, y: 297 } },
    });
  });

  test("moves the blocks of a stack with blocks, expanded or collapsed, by the distance that its box moves", () => {
    expect(movedBy(canvas(), ["s:s1", "s:s3"], 10, 20, LAYOUT)).toEqual({
      positions: { a: { x: 10, y: 20 }, b: { x: 10, y: 170 }, e: { x: 910, y: 20 } },
      points: {},
    });
  });

  test("rounds each position to the snap size while snapping is on", () => {
    expect(movedBy(canvas(), ["b:c", "s:s2"], 7, -3, SNAPPING)).toEqual({
      positions: { c: { x: 300, y: 140 } },
      points: { s2: { x: 600, y: 300 } },
    });
  });

  test("ignores what is no node of the DAG's", () => {
    expect(movedBy(canvas(), ["x:y", "b:gone"], 7, -3, LAYOUT)).toEqual(NO_MOVES);
  });
});

describe("a drag", () => {
  test("moves every node by the distance that the node under the pointer has moved", () => {
    const start = canvas();
    const moved = dragMoves(start, ["b:c", "b:d"], { x: 300, y: 150 }, { x: 345, y: 140 }, LAYOUT);
    expect(moved.positions).toEqual({ c: { x: 345, y: 140 }, d: { x: 645, y: -10 } });
  });

  test("joins a block that the user drops inside the box of a stack that it is not in to that stack", () => {
    const start = canvas();
    const s2 = shownBox(start, "s2");
    const s1 = expandedBox(start, "s1");
    if (s2 === undefined || s1 === undefined) throw new Error("No box");
    // c lands in the box of s2, which holds no block, and b, which s1 holds,
    // stays in its own box.
    const moves = { positions: { c: { x: s2.x + 5, y: s2.y }, b: { x: 0, y: 140 } }, points: {} };
    expect([...joins(start, moves, ["b:c", "b:b"])]).toEqual([["c", "s2"]]);
  });

  test("joins the stack of the smallest box that holds the block, and nothing where a stack is dragged", () => {
    const start = canvas();
    const s3 = shownBox(start, "s3");
    if (s3 === undefined) throw new Error("No box");
    const moves = { positions: { d: { x: s3.x, y: s3.y } }, points: {} };
    expect([...joins(start, moves, ["b:d"])]).toEqual([["d", "s3"]]);
    expect([...joins(start, { positions: { a: { x: s3.x, y: s3.y } }, points: {} }, ["s:s1"])]).toEqual([]);
  });

  test("ends with one batch: the stacks that blocks join, then every block and stack without blocks that moved", () => {
    const start = canvas();
    const moves = { positions: { c: { x: 600, y: 310 }, d: { x: 600, y: 0 } }, points: { s2: { x: 610, y: 300 } } };
    expect(movesBatch(start, moves, new Map([["c", "s3"]]))).toEqual([
      { id: "blockr.core-change_stack", args: { id: "s3", blocks: ["e", "c"] } },
      { id: "blockr.graph-change_position", args: { positions: { c: { x: 600, y: 310 } }, stacks: { s2: { x: 610, y: 300 } } } },
    ]);
  });

  test("that moves nothing runs nothing", () => {
    expect(movesBatch(canvas(), { positions: { c: { x: 300, y: 150 } }, points: {} })).toEqual([]);
  });
});

describe("a press of an arrow key", () => {
  test("moves a node as React Flow moves it", () => {
    const moved = keyMoves(canvas(), new Map([["b:c", { x: 305, y: 150 }]]), LAYOUT);
    expect(moved.positions).toEqual({ c: { x: 305, y: 150 } });
  });

  test("moves a node by the snap size along the axis along which React Flow moved it, while snapping is on", () => {
    // Block c sits at (300, 150), off the grid along y, which it joins as it
    // moves.
    expect(keyMoves(canvas(), new Map([["b:c", { x: 305, y: 150 }]]), SNAPPING).positions).toEqual({ c: { x: 320, y: 160 } });
    expect(keyMoves(canvas(), new Map([["b:c", { x: 300, y: 130 }]]), SNAPPING).positions).toEqual({ c: { x: 300, y: 140 } });
    // A move of less than a pixel along an axis, as what adding offsets
    // leaves, moves the node along no axis.
    expect(keyMoves(canvas(), new Map([["b:d", { x: 620, y: 1e-9 }]]), SNAPPING).positions).toEqual({ d: { x: 620, y: 0 } });
  });

  test("moves the blocks of a stack's box", () => {
    const start = canvas();
    const box = shownBox(start, "s1");
    if (box === undefined) throw new Error("No box");
    const moved = keyMoves(start, new Map([["s:s1", { x: box.x + 5, y: box.y }]]), LAYOUT);
    expect(moved.positions).toEqual({ a: { x: 5, y: 0 }, b: { x: 5, y: 150 } });
  });
});

describe("the centre of a node", () => {
  test("is a block's position, or the centre of a stack's box as the DAG shows it", () => {
    const start = canvas();
    expect(centreOf(start, "b:c")).toEqual({ x: 300, y: 150 });
    expect(centreOf(start, "s:s2")).toEqual({ x: 600, y: 300 });
    expect(centreOf(start, "s:s1")).toEqual({ x: expandedBox(start, "s1")?.x, y: expandedBox(start, "s1")?.y });
    expect(centreOf(start, "l:l1")).toBeUndefined();
  });
});
