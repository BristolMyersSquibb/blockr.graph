// The `afterStep` of the DAG plugin's class
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-classs-update-and-afterstep).
// Once the last delta of a step is in, it brings the state in line with the
// board that the step leaves:
//
// 1. It places every block and every stack without blocks that the step
//    adds, from where the step puts it, through the strategy, which under
//    Repulsion makes room around them (../placement).
// 2. A stack that the step leaves without blocks gets a position, its box
//    centred where the box that its blocks spanned before the step was,
//    rather than a place from the strategy. The position takes the place of
//    `collapsed` and `moved` in its entry, since a stack that holds no block
//    shows as a collapsed stack does already.
// 3. It makes room around each stack whose box the step grew or formed,
//    whatever the placement, so that no stack's box holds a block that the
//    stack does not hold, and no two stacks' boxes come within the gap of
//    each other (clearStacks() in ../room).
// 4. It drops each block and stack that making room moves from what
//    collapses moved, so that no expand puts it back.
// 5. It drops the entry of each stack that holds a block and has a position.
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
import { boxOfBlock, canvasOf, changed, expandedBox, gapOf, merged, NO_CHANGES, shownBox, snapChanges, snapPoint } from "../geometry/index.ts";
import type { Box, Canvas } from "../geometry/index.ts";
import { changePatches, entryPatches, unmovedPatches } from "../patches/index.ts";
import { placeAdded } from "../placement/index.ts";
import { clearStacks } from "../room/index.ts";
import { graphState, isCollapse, isPoint } from "../state/index.ts";
import type { GraphState, Point, StackEntry } from "../state/index.ts";

// How far a block may move, or a box reach, in pixels, before it counts.
const LEAST = 0.5;

export function afterStep(board: Board, before: Board, plugin: Pick<PluginClassId, "package" | "id">): Patch[] {
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
  const placed = added.blocks.size + added.stacks.size === 0 ? NO_CHANGES : placeAdded(canvasOf(board, state), added, moved, state.layout);

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

  // Making room around each stack whose box the step grew or formed, on the
  // canvas that placing leaves, with the positions of the stacks that the
  // step leaves without blocks. What the step adds, the blocks that it moves
  // and the stacks without blocks that it moves stay where they are.
  const points = Object.fromEntries(Object.entries(entries).flatMap(([id, entry]) => (entry !== null && isPoint(entry) ? [[id, entry]] : [])));
  const canvas = changed(canvasOf(board, state), merged(placed, { positions: {}, points }));
  const grown = prior === undefined ? new Set<StackId>() : grownStacks(canvasOf(before, prior), canvas);
  const kept = {
    blocks: new Set([...added.blocks, ...moved]),
    stacks: new Set([...added.stacks, ...Object.keys(board.stacks).filter((id) => movedStack(prior, state, id))]),
  };
  const room = grown.size === 0 ? NO_CHANGES : snapChanges(canvas, clearStacks(canvas, grown, kept, gapOf(state.layout.spacing)), state.layout);
  const changes = merged(placed, room);

  const pushed = (ids: Iterable<string>, of: ReadonlySet<string>) => [...ids].filter((id) => !of.has(id));
  return [
    ...changePatches(state, changes, plugin),
    ...unmovedPatches(
      state,
      pushed(Object.keys(changes.positions), added.blocks),
      pushed(Object.keys(changes.points), added.stacks),
      plugin,
      emptied,
    ),
    ...entryPatches(state, entries, plugin),
  ];
}

// Whether the step moves the stack, as a stack that holds no block, from one
// position to another.
function movedStack(prior: GraphState | undefined, state: GraphState, stack: StackId): boolean {
  const [was, now] = [prior?.stacks[stack], state.stacks[stack]];
  return was !== undefined && now !== undefined && isPoint(was) && isPoint(now) && !samePoint(was, now);
}

// The stacks whose boxes the step grew or formed, from the canvas before the
// step and the one after it:
// - The step formed the box of a stack that shows a box now and showed none
//   before, or that held blocks before and holds none now, or the other way
//   round.
// - The step grew the box of a stack whose blocks it changed, other than by
//   moving them all by one distance, where the box now reaches beyond where
//   it was. It changes them by adding or removing blocks, renaming one, or
//   moving some of them apart from the others.
// So the step grows no stack that moves as one, as where someone drags it or
// the DAG makes room, and no stack that collapses or expands.
function grownStacks(before: Canvas, after: Canvas): Set<StackId> {
  const grown = new Set<StackId>();
  for (const [id, stack] of Object.entries(after.board.stacks)) {
    const now = shownBox(after, id);
    if (now === undefined) continue;
    const was = shownBox(before, id);
    const filled = (stack.blocks.length > 0) !== ((before.board.stacks[id]?.blocks.length ?? 0) > 0);
    if (was === undefined || filled || (reshaped(before, after, id) && !within(now, was))) grown.add(id);
  }
  return grown;
}

// Whether the step changed the blocks of the stack other than by moving them
// all by one distance: which blocks it holds, the name of one, or where some
// of them sit against the others.
function reshaped(before: Canvas, after: Canvas, stack: StackId): boolean {
  const was = before.board.stacks[stack]?.blocks ?? [];
  const now = after.board.stacks[stack]?.blocks ?? [];
  if (was.length !== now.length || now.some((block) => !was.includes(block))) return true;
  let by: Point | undefined;
  for (const block of now) {
    const [a, b] = [boxOfBlock(before, block), boxOfBlock(after, block)];
    if (a === undefined || b?.w !== a.w) return true;
    by ??= { x: b.x - a.x, y: b.y - a.y };
    if (Math.abs(b.x - a.x - by.x) >= LEAST || Math.abs(b.y - a.y - by.y) >= LEAST) return true;
  }
  return false;
}

// Whether the first box lies within the second.
function within(inner: Box, outer: Box): boolean {
  return (
    Math.abs(inner.x - outer.x) + inner.w / 2 <= outer.w / 2 + LEAST &&
    Math.abs(inner.y - outer.y) + inner.h / 2 <= outer.h / 2 + LEAST
  );
}

// Whether two positions are the same, or both lacking.
function samePoint(a: Point | undefined, b: Point | undefined): boolean {
  return a === b || (a !== undefined && a.x === b?.x && a.y === b.y);
}
