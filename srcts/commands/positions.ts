// The DAG's command that moves blocks, and stacks that hold no block, as a
// drag or a run of presses of the arrow keys ends
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#commands).
// A position that it gives a block that the same step adds is where placing
// starts the block.
// While `snap` is on, each position that it sets rounds to the snap size, and
// only rounds, since someone chose the place.
// It drops each block and stack that it moves from what collapses moved, so
// that no expand puts it back.

import type { BlockId, StackId } from "@blockr/core";
import { snapPoint } from "../geometry/index.ts";
import { changePatches, unmovedPatches } from "../patches/index.ts";
import { GRAPH, graphState } from "../state/index.ts";
import type { Point } from "../state/index.ts";
import { command, passes, stateFailures } from "./common.ts";
import * as schemas from "./schemas.ts";

interface ChangePosition {
  readonly positions?: Readonly<Record<BlockId, Point>>;
  readonly stacks?: Readonly<Record<StackId, Point>>;
}

export const positionCommands = [
  command<ChangePosition>({
    id: "blockr.graph-change_position",
    label: "Move blocks",
    description:
      "Moves blocks, and stacks that hold no block, to the positions given, as a drag on the canvas does. A block's position is the centre of its mark. A stack that holds blocks has no position of its own, since its box fits its blocks, so move its blocks instead. A position given for a block that the same batch adds is where the DAG starts to place it, after the command that adds it. Every block and stack left out stays where it is.",
    args: schemas.object({
      positions: schemas.points("The new positions of blocks, by the id of each block."),
      stacks: schemas.points("The new positions of stacks that hold no block, by the id of each stack."),
    }),
    preflight(board, { positions = {}, stacks = {} }, context) {
      const lacking = Object.keys(positions).filter((block) => !Object.hasOwn(board.blocks, block));
      const absent = Object.keys(stacks).filter((stack) => !Object.hasOwn(board.stacks, stack));
      const holding = Object.keys(stacks).filter((stack) => (board.stacks[stack]?.blocks.length ?? 0) > 0);
      return passes(
        [
          ...stateFailures(board),
          ...lacking.map((block) => `The board holds no block "${block}".`),
          ...absent.map((stack) => `The board holds no stack "${stack}".`),
          ...holding.map((stack) => `The stack "${stack}" holds blocks, so its box fits them and it takes no position.`),
        ],
        context,
      );
    },
    run(board, { positions = {}, stacks = {} }) {
      const state = graphState(board);
      if (state === undefined) return [];
      const round = (point: Point) => (state.layout.snap ? snapPoint(point, state.layout.snap_size) : point);
      const rounded = (points: Readonly<Record<string, Point>>) =>
        Object.fromEntries(Object.entries(points).map(([id, point]) => [id, round(point)]));
      const changes = { positions: rounded(positions), points: rounded(stacks) };
      return {
        patches: [
          ...changePatches(state, changes, GRAPH),
          ...unmovedPatches(state, Object.keys(positions), Object.keys(stacks), GRAPH),
        ],
      };
    },
  }),
];
