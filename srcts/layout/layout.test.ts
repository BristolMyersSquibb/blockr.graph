// Laying the whole board out with dagre: every block and every stack that
// holds no block gets a position, the same board gets the same positions, and
// the boxes that the DAG draws around the stacks' blocks hold no other node.

import { beforeAll, describe, expect, test } from "vitest";
import { canvasNodes, canvasOf, changed, expandedBox, overlaps } from "../geometry/index.ts";
import type { Layout } from "../state/index.ts";
import { boardOf, furthest, intruders, layeredBoard, SHAPES, stackSpecs, stateOf, withStacks, withState } from "../testing/index.ts";
import { layOut, loadDagre } from "./index.ts";
import type { Dagre } from "./index.ts";

let dagre: Dagre;
beforeAll(async () => {
  dagre = await loadDagre();
});

test("loads dagre once", async () => {
  expect(await loadDagre()).toBe(dagre);
});

describe.each(["compact", "normal", "loose"] as const)("a layout with the spacing %s", (spacing) => {
  test.each(["TB", "LR"] as const)("leaves each stack's box clear of other nodes, laid out %s", (direction) => {
    const settings = { direction, spacing };
    const plain = layeredBoard({ ...SHAPES.square, seed: 11 });
    const first = layOut(dagre, canvasOf(plain, stateOf(plain)), settings);
    const board = withStacks(plain, stackSpecs(Object.keys(plain.blocks).length), first.positions);
    const canvas = canvasOf(board, stateOf(board));
    const laid = changed(canvas, layOut(dagre, canvas, settings));

    expect(Object.keys(laid.positions).sort()).toEqual(Object.keys(board.blocks).sort());
    expect(intruders(laid)).toEqual([]);
    const boxes = Object.keys(board.stacks).flatMap((stack) => expandedBox(laid, stack) ?? []);
    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    const nodes = canvasNodes(laid);
    for (const [i, a] of nodes.entries()) for (const b of nodes.slice(i + 1)) expect(overlaps(a.box, b.box)).toBe(false);
  });
});

describe("laying the board out", () => {
  const settings = { direction: "TB", spacing: "normal" } as const;

  test("gives the same positions for the same board", () => {
    const board = layeredBoard({ ...SHAPES.small, seed: 5 });
    const canvas = canvasOf(board, stateOf(board));
    expect(layOut(dagre, canvas, settings)).toEqual(layOut(dagre, canvasOf(structuredClone(board), stateOf(board)), settings));
  });

  test("places each stack that holds no block as one node of its box's size", () => {
    const board = boardOf({ blocks: { a: "A", b: "B" }, links: [["a", "b"]], stacks: { empty: [] } });
    const laid = layOut(dagre, canvasOf(board, stateOf(board)), settings);
    expect(Object.keys(laid.points)).toEqual(["empty"]);
    expect(laid.positions.b?.y).toBeGreaterThan(laid.positions.a?.y ?? Infinity);
  });

  test("runs the board the layout's way", () => {
    const board = boardOf({ blocks: { a: "A", b: "B" }, links: [["a", "b"]] });
    const laid = layOut(dagre, canvasOf(board, stateOf(board)), { direction: "LR", spacing: "normal" });
    expect(laid.positions.b?.x).toBeGreaterThan(laid.positions.a?.x ?? Infinity);
    expect(laid.positions.b?.y).toBe(laid.positions.a?.y);
  });

  test("moves a collapsed stack as one node, whose blocks keep their places in it", () => {
    const board = boardOf({
      blocks: { a: "A", b: "B", c: "C", d: "D" },
      links: [["a", "b"], ["b", "c"], ["c", "d"]],
      stacks: { s: ["b", "c"] },
      state: {
        positions: { a: { x: 0, y: 0 }, b: { x: 500, y: 500 }, c: { x: 600, y: 520 }, d: { x: 0, y: 900 } },
        stacks: { s: { collapsed: 1, moved: { positions: {}, stacks: {} } } },
      },
    });
    const state = stateOf(board);
    const laid = layOut(dagre, canvasOf(board, state), settings);
    const [b, c] = [laid.positions.b, laid.positions.c];
    expect((c?.x ?? 0) - (b?.x ?? 0)).toBeCloseTo(100);
    expect((c?.y ?? 0) - (b?.y ?? 0)).toBeCloseTo(20);
    expect(furthest(state.positions, laid.positions, ["b"])).toBeGreaterThan(0);
  });

  test("lays a collapsed stack out as a cluster where its blocks have no positions", () => {
    const board = boardOf({
      blocks: { a: "A", b: "B", c: "C" },
      links: [["a", "b"], ["b", "c"]],
      stacks: { s: ["b", "c"] },
      state: { stacks: { s: { collapsed: 1, moved: { positions: {}, stacks: {} } } } },
    });
    const laid = layOut(dagre, canvasOf(board, stateOf(board)), settings);
    expect(Object.keys(laid.positions).sort()).toEqual(["a", "b", "c"]);
    expect(laid.positions.c?.y).toBeGreaterThan(laid.positions.b?.y ?? Infinity);
  });

  test("gives the same positions whatever positions the blocks had", () => {
    const layout: Layout = { direction: "TB", spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 };
    const board = layeredBoard({ ...SHAPES.small, seed: 5 });
    const laid = layOut(dagre, canvasOf(board, stateOf(board)), layout);
    const moved = withState(board, { positions: laid.positions });
    expect(layOut(dagre, canvasOf(moved, stateOf(moved)), layout).positions).toEqual(laid.positions);
  });
});
