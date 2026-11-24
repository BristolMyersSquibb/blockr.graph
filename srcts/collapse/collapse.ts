// Collapsing and expanding a stack
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#collapsing-and-expanding-a-stack).
// A collapsed stack's box is centred where its expanded box is, around its
// blocks, which keep their positions while they hide.
// Its entry in `stacks` holds `collapsed`, its place among the collapses, and
// `moved`, what its collapse moved, from where and to where.
//
// - Collapsing shrinks the box to its collapsed size, and the nodes around it
//   close up on it (closeUp() in ../room). The collapse takes the place after
//   the last collapse, and keeps in `moved` each block, and each stack that
//   holds no block, that it moved.
// - Expanding a stack takes these steps:
//   1. It undoes the collapses made after it, latest first, then its own,
//      putting back each block and stack that still sits where a collapse
//      moved it.
//   2. It grows the box back around its blocks and makes room around it, so
//      that whatever lies in it moves out (clearBox() in ../room).
//   3. It collapses the stacks that collapsed after it again, in their order,
//      each keeping its moves anew.
//   So the board ends as if the stack had never collapsed, in whatever order
//   the stacks collapse and expand, and once every stack is expanded, every
//   block is back where it was, but for what someone moved meanwhile.
//
// While `snap` is on, every position that a collapse or an expand sets
// snaps, before it goes into `moved`.

import type { BlockId, Board, StackId } from "@blockr/core";
import { canvasOf, changed, gapOf, snapChanges } from "../geometry/index.ts";
import type { Canvas, Changes } from "../geometry/index.ts";
import { clearBox, closeUp } from "../room/index.ts";
import { isCollapse } from "../state/index.ts";
import type { Collapse, GraphState, Layout, Move, Moved, Point } from "../state/index.ts";

// What collapsing or expanding a stack leaves: the positions that it
// changes, and the entries in `stacks` that it sets, or removes for null.
export interface Folded {
  readonly changes: Changes;
  readonly entries: Readonly<Record<StackId, Collapse | null>>;
}

// How close to where a collapse moved it a block has to sit for an expand to
// put it back, in pixels.
const STILL = 0.5;

// The collapses of the board's stacks with blocks, by stack, in the order
// they were made.
export function collapses(board: Board, state: GraphState): [StackId, Collapse][] {
  return Object.entries(state.stacks)
    .flatMap(([stack, entry]): [StackId, Collapse][] =>
      isCollapse(entry) && (board.stacks[stack]?.blocks.length ?? 0) > 0 ? [[stack, entry]] : [],
    )
    .sort(([, a], [, b]) => a.collapsed - b.collapsed);
}

// Collapsing the stack, which the board holds with blocks, and which shows
// expanded.
export function collapse(board: Board, state: GraphState, stack: StackId): Folded {
  const made = collapses(board, state);
  const place = Math.max(0, ...made.map(([, entry]) => entry.collapsed)) + 1;
  const { changes, moved } = closingUp(canvasOf(board, state), stack, state.layout);
  return { changes, entries: { [stack]: { collapsed: place, moved } } };
}

// Expanding the stack, which the board holds with blocks, and which shows
// collapsed.
export function expand(board: Board, state: GraphState, stack: StackId): Folded {
  const made = collapses(board, state);
  const own = made.find(([id]) => id === stack)?.[1];
  const start = canvasOf(board, state);
  if (own === undefined) return { changes: { positions: {}, points: {} }, entries: {} };
  const earlier = made.filter(([, entry]) => entry.collapsed < own.collapsed).map(([id]) => id);
  const later = made.filter(([, entry]) => entry.collapsed > own.collapsed);

  let canvas = start;
  for (const [, entry] of [...later].reverse()) canvas = undone(canvas, entry.moved);
  canvas = { ...undone(canvas, own.moved), collapsed: new Set(earlier) };
  const gap = gapOf(state.layout.spacing);
  canvas = changed(canvas, snapChanges(canvas, clearBox(canvas, stack, gap), state.layout));

  const entries: Record<StackId, Collapse | null> = { [stack]: null };
  for (const [id, entry] of later) {
    const { changes, moved } = closingUp(canvas, id, state.layout);
    canvas = { ...changed(canvas, changes), collapsed: new Set([...canvas.collapsed, id]) };
    entries[id] = { collapsed: entry.collapsed, moved };
  }
  return { changes: difference(start, canvas), entries };
}

// The changes of collapsing the stack on the canvas, snapped, and what they
// moved, from where and to where.
function closingUp(canvas: Canvas, stack: StackId, layout: Layout): { changes: Changes; moved: Moved } {
  const changes = snapChanges(canvas, closeUp(canvas, stack, gapOf(layout.spacing)), layout);
  return { changes, moved: { positions: moves(canvas.positions, changes.positions), stacks: moves(canvas.points, changes.points) } };
}

// The canvas with what a collapse moved put back, for each block and stack
// that still sits where the collapse moved it.
function undone(canvas: Canvas, moved: Moved): Canvas {
  const back = (now: Readonly<Record<string, Point>>, made: Readonly<Record<string, Move>>) =>
    Object.fromEntries(
      Object.entries(made).flatMap(([id, move]) => {
        const point = now[id];
        const still = point !== undefined && Math.hypot(point.x - move.to.x, point.y - move.to.y) < STILL;
        return still ? [[id, move.from]] : [];
      }),
    );
  return changed(canvas, { positions: back(canvas.positions, moved.positions), points: back(canvas.points, moved.stacks) });
}

// The moves from the points of `from` to the points of `to`, for each id that
// both hold at different points.
function moves(from: Readonly<Record<string, Point>>, to: Readonly<Record<string, Point>>): Record<string, Move> {
  return Object.fromEntries(
    Object.entries(to).flatMap(([id, point]) => {
      const was = from[id];
      return was === undefined || (was.x === point.x && was.y === point.y) ? [] : [[id, { from: was, to: point }]];
    }),
  );
}

// The changes that take the board's blocks and its stacks that hold no block
// from where the first canvas places them to where the second does.
function difference(first: Canvas, second: Canvas): Changes {
  const changes = (from: Readonly<Record<string, Point>>, to: Readonly<Record<string, Point>>, ids: readonly string[]) =>
    Object.fromEntries(
      ids.flatMap((id) => {
        const [was, now] = [from[id], to[id]];
        return now === undefined || (was?.x === now.x && was.y === now.y) ? [] : [[id, now]];
      }),
    );
  const blocks: BlockId[] = Object.keys(first.board.blocks);
  return {
    positions: changes(first.positions, second.positions, blocks),
    points: changes(first.points, second.points, Object.keys(first.points)),
  };
}
