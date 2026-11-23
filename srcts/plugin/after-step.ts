// The `afterStep` of the DAG plugin's class
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-classs-update-and-afterstep).
// Once the last delta of a step is in, it brings the state in line with the
// board that the step leaves:
//
// 1. It places every block and every stack without blocks that the step
//    adds, from where the step puts it, through the strategy, which under
//    Repulsion makes room around them (../placement). It drops each block and
//    stack that making room moves from what collapses moved, so that no
//    expand puts it back.
// 2. A stack that the step leaves without blocks gets a position, its box
//    centred where the box that its blocks spanned before the step was,
//    rather than a place from the strategy. The position takes the place of
//    `collapsed` and `moved` in its entry, since a stack that holds no block
//    shows as a collapsed stack does already.
// 3. It drops the entry of each stack that holds a block and has a position.
//
// So a batch that adds a block and then links it places the block by its
// link, which `update` would not see yet as it is given the block's delta,
// and a batch that empties a stack and fills it again leaves the stack with
// no position.
// It leaves alone a block that had no position before the step either, and a
// stack that held no block and had no position before the step either. Only a
// board that has just opened holds such a block or stack, and the class's
// start gives each a position.
// It reads only the two boards, never the page, so that every peer computes
// the same patches. The store calls it after undos and redos too, which put
// back what they take back with its position.

import type { Board, Patch, PluginClassId, StackId } from "@blockr/core";
import { canvasOf, expandedBox, snapPoint } from "../geometry/index.ts";
import { changePatches, entryPatches, unmovedPatches } from "../patches/index.ts";
import { placeAdded } from "../placement/index.ts";
import { graphState, isCollapse } from "../state/index.ts";
import type { Point, StackEntry } from "../state/index.ts";

export function afterStep(board: Board, before: Board, plugin: PluginClassId): Patch[] {
  const state = graphState(board, plugin);
  if (state === undefined) return [];
  const prior = graphState(before, plugin);

  const added = {
    blocks: new Set(Object.keys(board.blocks).filter((block) => !Object.hasOwn(before.blocks, block))),
    stacks: new Set(
      Object.entries(board.stacks)
        .filter(([id, stack]) => stack.blocks.length === 0 && !Object.hasOwn(before.stacks, id))
        .map(([id]) => id),
    ),
  };
  const moved = new Set(
    Object.keys(board.blocks).filter((block) => !added.blocks.has(block) && !samePoint(prior?.positions[block], state.positions[block])),
  );
  const placed =
    added.blocks.size + added.stacks.size === 0
      ? { positions: {}, points: {} }
      : placeAdded(canvasOf(board, state), added, moved, state.layout);

  const entries: Record<StackId, StackEntry | null> = {};
  const emptied = new Set<StackId>();
  for (const [id, stack] of Object.entries(board.stacks)) {
    const was = before.stacks[id];
    const entry = state.stacks[id];
    if (stack.blocks.length === 0 && was !== undefined && was.blocks.length > 0) {
      emptied.add(id);
      const box = prior === undefined ? undefined : expandedBox(canvasOf(before, prior), id);
      if (box !== undefined) entries[id] = state.layout.snap ? snapPoint(box, state.layout.snap_size) : { x: box.x, y: box.y };
    } else if (stack.blocks.length > 0 && entry !== undefined && !isCollapse(entry)) {
      entries[id] = null;
    }
  }

  const pushed = (ids: Iterable<string>, of: ReadonlySet<string>) => [...ids].filter((id) => !of.has(id));
  return [
    ...changePatches(state, placed, plugin),
    ...unmovedPatches(
      state,
      pushed(Object.keys(placed.positions), added.blocks),
      pushed(Object.keys(placed.points), added.stacks),
      plugin,
      emptied,
    ),
    ...entryPatches(state, entries, plugin),
  ];
}

// Whether two positions are the same, or both lacking.
function samePoint(a: Point | undefined, b: Point | undefined): boolean {
  return a === b || (a !== undefined && a.x === b?.x && a.y === b.y);
}

