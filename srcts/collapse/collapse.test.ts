// Collapsing and expanding stacks on the spike's layered boards, laid out
// both ways, against the criteria that the spike fixed before it ran
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3, notes):
// no new pair within the gap and no block in another stack's box, no two
// nodes within two gaps swapping sides, the blocks of each stack moving by
// one distance, and every block back where it was once every stack is
// expanded again, in whatever order they collapse and expand.

import type { Board } from "@blockr/core";
import { beforeAll, describe, expect, test } from "vitest";
import { canvasOf, distance, gapOf, shownBox } from "../geometry/index.ts";
import { layOut, loadDagre } from "../layout/index.ts";
import type { Dagre } from "../layout/index.ts";
import type { Layout } from "../state/index.ts";
import { boardOf, folded, furthest, intruders, layeredBoard, lcg, newlyClose, reshaped, SHAPES, stackSpecs, stateOf, swapped, withStacks, withState } from "../testing/index.ts";
import { collapse, collapses, expand } from "./index.ts";

let dagre: Dagre;
beforeAll(async () => {
  dagre = await loadDagre();
});

// A board of the shape, with its stacks, laid out with the layout.
function laidOut(shape: keyof typeof SHAPES, layout: Layout): Board {
  const plain = layeredBoard({ ...SHAPES[shape], seed: 11 });
  const first = layOut(dagre, canvasOf(plain, stateOf(plain)), layout);
  const stacked = withStacks(plain, stackSpecs(Object.keys(plain.blocks).length), first.positions);
  const laid = layOut(dagre, canvasOf(stacked, stateOf(stacked)), layout);
  return withState(stacked, { positions: laid.positions, layout });
}

const layouts: Layout[] = (["TB", "LR"] as const).map((direction) => ({
  direction,
  spacing: "normal",
  placement: "repulsion",
  snap: false,
  snap_size: 20,
}));

describe.each(layouts)("collapsing and expanding stacks laid out $direction", (layout) => {
  const gap = gapOf(layout.spacing);

  test.each(["small", "square", "wide", "deep"] as const)("on a %s board, each stack in turn", (shape) => {
    const board = laidOut(shape, layout);
    const start = stateOf(board);
    for (const stack of Object.keys(board.stacks)) {
      const closed = folded(start, collapse(board, start, stack));
      const [before, after] = [canvasOf(board, start), canvasOf(board, closed)];
      expect(newlyClose(before, after, gap), `collapsing ${stack}`).toEqual([]);
      expect(intruders(after), `collapsing ${stack}`).toEqual([]);
      expect(swapped(before, after, gap), `collapsing ${stack}`).toEqual([]);
      expect(reshaped(before, after), `collapsing ${stack}`).toEqual([]);

      const open = folded(closed, expand(board, closed, stack));
      expect(reshaped(after, canvasOf(board, open)), `expanding ${stack}`).toEqual([]);
      expect(furthest(start.positions, open.positions, Object.keys(board.blocks)), `expanding ${stack}`).toBeLessThan(1);
      expect(open.stacks).toEqual(start.stacks);
    }
  });

  test("closes up on the stack, the nearest nodes the most", () => {
    const board = laidOut("square", layout);
    const start = stateOf(board);
    const closed = collapse(board, start, "big");
    const moved = Object.keys(closed.changes.positions);
    expect(moved.length).toBeGreaterThan(0);
    expect(Object.keys(closed.entries)).toEqual(["big"]);
    expect(closed.entries.big?.collapsed).toBe(1);
    expect(Object.keys(closed.entries.big?.moved.positions ?? {}).sort()).toEqual(moved.sort());
  });

  test("puts every block back once every stack is expanded, in random orders", () => {
    const board = laidOut("square", layout);
    const start = stateOf(board);
    const stacks = Object.keys(board.stacks);
    const random = lcg(7);
    for (let run = 0; run < 5; run++) {
      let state = start;
      for (let step = 0; step < 10; step++) {
        const stack = stacks[Math.floor(random() * stacks.length)] ?? "big";
        const shut = collapses(board, state).some(([id]) => id === stack);
        state = folded(state, shut ? expand(board, state, stack) : collapse(board, state, stack));
        const canvas = canvasOf(board, state);
        expect(intruders(canvas), `run ${String(run)}, step ${String(step)}`).toEqual([]);
      }
      for (const [stack] of collapses(board, state).reverse()) state = folded(state, expand(board, state, stack));
      expect(furthest(start.positions, state.positions, Object.keys(board.blocks)), `run ${String(run)}`).toBeLessThan(1);
    }
  });
});

test("moves another stack that lies in the box of a stack that expands out of it as one", () => {
  const board = boardOf({
    blocks: { a: "A", b: "B", c: "C", d: "D" },
    stacks: { s: ["a", "b"], t: ["c", "d"] },
    state: {
      positions: { a: { x: 0, y: 0 }, b: { x: 300, y: 200 }, c: { x: 20, y: 100 }, d: { x: 150, y: 220 } },
      stacks: { s: { collapsed: 1, moved: { positions: {}, stacks: {} } } },
    },
  });
  const open = withState(board, folded(stateOf(board), expand(board, stateOf(board), "s")));
  const canvas = canvasOf(open, stateOf(open));
  const [s, t] = [shownBox(canvas, "s"), shownBox(canvas, "t")];
  if (s === undefined || t === undefined) throw new Error("no box");
  expect(distance(s, t)).toBeGreaterThan(gapOf("normal") - 0.5);
  expect(reshaped(canvasOf(board, stateOf(board)), canvas)).toEqual([]);
});
