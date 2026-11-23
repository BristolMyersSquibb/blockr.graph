// Collapsing and expanding stacks on the spike's layered boards, laid out
// both ways, against the criteria that the spike fixed before it ran
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3, notes):
// no new pair within the gap and no block in another stack's box, no two
// nodes within two gaps swapping sides, and every block back where it was
// once every stack is expanded again, in whatever order they collapse and
// expand.

import type { Board, StackId } from "@blockr/core";
import { beforeAll, describe, expect, test } from "vitest";
import { canvasOf, gapOf } from "../geometry/index.ts";
import { layOut, loadDagre } from "../layout/index.ts";
import type { Dagre } from "../layout/index.ts";
import type { GraphState, Layout, StackEntry } from "../state/index.ts";
import { furthest, intruders, layeredBoard, lcg, newlyClose, SHAPES, stackSpecs, stateOf, swapped, withStacks, withState } from "../testing/index.ts";
import { collapse, collapses, expand } from "./index.ts";
import type { Folded } from "./index.ts";

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

// The state after the fold.
function folded(state: GraphState, { changes, entries }: Folded): GraphState {
  const stacks: Record<StackId, StackEntry> = { ...state.stacks, ...changes.points };
  for (const [id, entry] of Object.entries(entries)) {
    if (entry === null) Reflect.deleteProperty(stacks, id);
    else stacks[id] = entry;
  }
  return { ...state, positions: { ...state.positions, ...changes.positions }, stacks };
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

      const open = folded(closed, expand(board, closed, stack));
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
