// Where a paste or an add lands near the point at which the user pastes or
// adds it (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
// The boards here have the normal spacing, whose gap is 70 px, and every
// block's name is one letter, so every block's node is the mark's 32 px across
// and 52 px tall with its name.

import { describe, expect, test } from "vitest";
import { blockBox, canvasOf } from "../geometry/index.ts";
import type { Box } from "../geometry/index.ts";
import { boardOf, stateOf } from "../testing/index.ts";
import type { BoardSpec } from "../testing/index.ts";
import { freeOffset } from "./index.ts";

// The offset at which a block's node lands near the point, on the board.
function landing(spec: BoardSpec, point: { x: number; y: number }, boxes: readonly Box[] = [blockBox(point, "N")]) {
  const board = boardOf(spec);
  return freeOffset(canvasOf(board, stateOf(board)), boxes, stateOf(board).layout);
}

describe("what lands near a point", () => {
  test("stays at the point where it keeps the gap from every node", () => {
    expect(landing({ blocks: { a: "A" }, state: { positions: { a: { x: 0, y: 0 } } } }, { x: 0, y: 130 })).toEqual({ x: 0, y: 0 });
  });

  test("moves off a node to the nearest spot that keeps the gap", () => {
    // Beside the block, the gap takes 32 + 70 = 102 px, which the grid of 10
    // px rounds up to 110, and below or above it 52 + 70 = 122 px.
    expect(landing({ blocks: { a: "A" }, state: { positions: { a: { x: 0, y: 0 } } } }, { x: 0, y: 0 })).toEqual({ x: -110, y: 0 });
  });

  test("keeps the gap from the padding around each block of a stack that does not hold it, but not from the stack's box", () => {
    const stacked: BoardSpec = {
      blocks: { a: "A", b: "B" },
      stacks: { s: ["a", "b"] },
      state: { positions: { a: { x: 0, y: 0 }, b: { x: 400, y: 0 } } },
    };
    // Between the blocks, the node keeps the gap from the padding of 20 px
    // around each, so it stays where it lands, in the stack's box.
    expect(landing(stacked, { x: 200, y: 0 })).toEqual({ x: 0, y: 0 });
    // Beside block a, the node keeps the gap from the padding around a at
    // 16 + 20 + 70 + 16 = 122 px from a's middle, which the grid rounds up
    // to 130, where it keeps 32 + 70 = 102 px from a without the stack.
    expect(landing(stacked, { x: 100, y: 0 })).toEqual({ x: 30, y: 0 });
    expect(landing({ ...stacked, stacks: {} }, { x: 100, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  test("keeps the gap with every box of what lands, which moves as one", () => {
    const point = { x: 0, y: 0 };
    const pair = [blockBox(point, "N"), blockBox({ x: 0, y: 200 }, "M")];
    // The lower box lands on the block, so the pair moves aside as one, as far
    // as the lower box needs to keep the gap beside the block.
    expect(landing({ blocks: { a: "A" }, state: { positions: { a: { x: 0, y: 200 } } } }, point, pair)).toEqual({ x: -110, y: 0 });
  });

  test("moves on the grid of the snap size while snapping is on, the spot above first of those as near", () => {
    const layout = { ...stateOf(boardOf({ blocks: {} })).layout, snap: true, snap_size: 25 };
    const spec: BoardSpec = { blocks: { a: "A" }, state: { positions: { a: { x: 0, y: 0 } }, layout } };
    // The grid of 25 px rounds both 102 px beside the block and 122 px above
    // it up to 125.
    expect(landing(spec, { x: 0, y: 0 })).toEqual({ x: 0, y: -125 });
  });

  test("stays at the point where no spot within reach is free", () => {
    const corners = { a: { x: -1600, y: -1600 }, b: { x: 1600, y: -1600 }, c: { x: -1600, y: 1600 }, d: { x: 1600, y: 1600 } };
    const spec: BoardSpec = { blocks: { a: "A", b: "B", c: "C", d: "D" }, stacks: { s: ["a", "b", "c", "d"] }, state: { positions: corners } };
    expect(landing(spec, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});
