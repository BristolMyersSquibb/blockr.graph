// Where the DAG starts what a board action adds, through the `extend` of
// core.boardActions.menu() and trigger(), which core hands the deltas that the
// board action's batch will apply, and whose commands run after the batch, in
// the same step
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
//
// - The menu of the canvas starts what its board action adds where the user
//   right-clicked, and a link dropped on the canvas starts the block that
//   Append block or Prepend block adds at the drop.
// - The toolbar's board actions on the board, such as Add block and Create
//   stack, start what they add at the middle of the view.
//
// The point goes to the block that the batch adds, or to the first of several
// in the order of their links, through blockr.graph-change_position, and the
// placement strategy starts the others against it. Where the batch adds no
// block, it goes to the stack that holds no block that the batch adds.
// Where the node would come within the spacing's gap of a node or a stack's
// box that the board shows, it goes to the free spot nearest the point
// instead, so that no block lands in a stack that does not hold it
// (../placement/free.ts).
// The DAG finds them in the deltas, whichever command adds them and whoever
// mints their ids, so that a template of blocks that a package's command adds
// lands there too.
// Where the batch gives what it adds a position itself, as Paste does, the
// DAG adds nothing, so that the batch keeps its own arrangement.

import type { Board, CommandCall, Delta } from "@blockr/core";
import { blockBox, canvasOf, stackBoxAt } from "../geometry/index.ts";
import type { Box } from "../geometry/index.ts";
import { freeOffset, linkOrder } from "../placement/index.ts";
import { graphState } from "../state/index.ts";
import type { GraphState, Point } from "../state/index.ts";

// The commands that start what the deltas add at the point, given the board
// that the deltas leave, before the class's afterStep places anything.
export function startAt(after: Board, deltas: readonly Delta[], point: Point): CommandCall[] {
  const blocks = new Set<string>();
  const stacks = new Set<string>();
  for (const delta of deltas) {
    for (const id of Object.keys(delta.blocks?.add ?? {})) if (Object.hasOwn(after.blocks, id)) blocks.add(id);
    for (const id of Object.keys(delta.stacks?.add ?? {})) if (after.stacks[id]?.blocks.length === 0) stacks.add(id);
  }
  const state = graphState(after);
  const placed = [...blocks].some((id) => state?.positions[id] !== undefined) || [...stacks].some((id) => state?.stacks[id] !== undefined);
  if (placed) return [];
  const [first] = linkOrder(after, blocks);
  if (first !== undefined) {
    const at = freeAt(after, state, blockBox(point, after.blocks[first]?.name ?? ""));
    return [{ id: "blockr.graph-change_position", args: { positions: { [first]: at } } }];
  }
  const [stack] = stacks;
  if (stack !== undefined) return [{ id: "blockr.graph-change_position", args: { stacks: { [stack]: freeAt(after, state, stackBoxAt(point)) } } }];
  return [];
}

// The centre of the box, moved to the free spot on the board nearest it.
function freeAt(board: Board, state: GraphState | undefined, box: Box): Point {
  const offset = state === undefined ? { x: 0, y: 0 } : freeOffset(canvasOf(board, state), [box], state.layout);
  return { x: box.x + offset.x, y: box.y + offset.y };
}
