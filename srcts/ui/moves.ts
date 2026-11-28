// What dragging nodes and pressing the arrow keys move, which the DAG keeps in
// its component until the drag ends or the user pauses, and then runs as one
// change_position of blockr.graph
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures).
// Each node is named by its id in React Flow (./ids.ts), and each point is a
// centre on the canvas, as the DAG's state keeps a position.
//
// - A block moves to its new position, and a stack that holds no block to the
//   new position of its box.
// - A stack with blocks, expanded or collapsed, moves its blocks by the
//   distance that its box moves.
// - While snapping is on, each position that a move gives rounds to the snap
//   size, so that the drag ends where change_position of blockr.graph keeps
//   each node.
// - A drag moves every node by the move of the node under the pointer, since
//   React Flow moves the node under the pointer by its drag threshold, 5 px,
//   more than the others where one of them is in a stack.

import type { BlockId, Board, CommandCall, CoreApi, Json, StackId } from "@blockr/core";
import { boxOfBlock, merged, nodeChanges, shifted, shownBox, snapPoint, stackOf } from "../geometry/index.ts";
import type { Box, Canvas, CanvasNode, Changes } from "../geometry/index.ts";
import type { Layout, Point } from "../state/index.ts";
import { objectOf } from "./ids.ts";

export const NO_MOVES: Changes = { positions: {}, points: {} };

// A node of the canvas, by its id in React Flow, with its box as the DAG shows
// it, or undefined where it has none.
function canvasNode(canvas: Canvas, node: string): CanvasNode | undefined {
  const object = objectOf(node);
  if (object === undefined) return undefined;
  if ("block" in object) {
    const box = boxOfBlock(canvas, object.block);
    return box === undefined ? undefined : { kind: "block", id: object.block, box, stack: stackOf(canvas.board).get(object.block) ?? null };
  }
  if (!("stack" in object)) return undefined;
  const box = shownBox(canvas, object.stack);
  return box === undefined ? undefined : { kind: "stack", id: object.stack, box, stack: object.stack };
}

// The centre of a node on the canvas: a block's position, or the centre of a
// stack's box as the DAG shows it, or undefined where it has none.
export function centreOf(canvas: Canvas, node: string): Point | undefined {
  const box = canvasNode(canvas, node)?.box;
  return box === undefined ? undefined : { x: box.x, y: box.y };
}

// The moves of the nodes given, each by the same distance, from where they sit
// on the canvas, each position rounded to the snap size while snapping is on.
export function movedBy(canvas: Canvas, nodes: Iterable<string>, dx: number, dy: number, layout: Layout): Changes {
  let changes = NO_MOVES;
  for (const id of nodes) {
    const node = canvasNode(canvas, id);
    if (node !== undefined) changes = merged(changes, nodeChanges(canvas, node, shifted(node.box, dx, dy)));
  }
  return layout.snap ? snapped(changes, layout.snap_size) : changes;
}

// The changes with each position rounded to the snap size.
function snapped(changes: Changes, size: number): Changes {
  const round = (points: Readonly<Record<string, Point>>) =>
    Object.fromEntries(Object.entries(points).map(([id, point]) => [id, snapPoint(point, size)]));
  return { positions: round(changes.positions), points: round(changes.points) };
}

// The moves of a drag of the nodes given, from where they sat as the drag
// started, by the distance that the node under the pointer has moved, from
// `from` to `to`.
export function dragMoves(start: Canvas, nodes: Iterable<string>, from: Point, to: Point, layout: Layout): Changes {
  return movedBy(start, nodes, to.x - from.x, to.y - from.y, layout);
}

// The moves of a press of an arrow key, after which React Flow has moved each
// node given to the centre given, by 5 px, or 20 px with Shift.
// While snapping is on, each node moves by the snap size instead, along the
// axis along which React Flow moved it, and its centre rounds.
// The DAG sets no snapping of React Flow's, since React Flow would round a
// node's top left corner rather than its centre, which moves the node along
// the other axis too.
export function keyMoves(canvas: Canvas, moved: ReadonlyMap<string, Point>, layout: Layout): Changes {
  const step = (by: number) => (Math.abs(by) < 1 ? 0 : Math.sign(by) * layout.snap_size);
  let changes: Changes = NO_MOVES;
  for (const [node, to] of moved) {
    const from = centreOf(canvas, node);
    if (from === undefined) continue;
    let [dx, dy] = [to.x - from.x, to.y - from.y];
    if (layout.snap) [dx, dy] = [step(dx), step(dy)];
    changes = merged(changes, movedBy(canvas, [node], dx, dy, layout));
  }
  return changes;
}

// The stack that each block of the drag joins: where a block that the user
// dragged, rather than its stack, ends inside the box of a stack that it is
// not in, it joins that stack, the smallest such box where several hold it.
// The boxes are those of the canvas as the drag started.
export function joins(start: Canvas, moves: Changes, nodes: Iterable<string>): Map<BlockId, StackId> {
  const held = stackOf(start.board);
  const boxes: [StackId, Box][] = [];
  for (const stack of Object.keys(start.board.stacks)) {
    const box = shownBox(start, stack);
    if (box !== undefined) boxes.push([stack, box]);
  }
  const joined = new Map<BlockId, StackId>();
  for (const node of nodes) {
    const object = objectOf(node);
    if (object === undefined || !("block" in object)) continue;
    const point = moves.positions[object.block];
    if (point === undefined) continue;
    const own = held.get(object.block);
    const holding = boxes
      .filter(([stack, box]) => stack !== own && contains(box, point))
      .sort(([, a], [, b]) => a.w * a.h - b.w * b.h);
    const [first] = holding;
    if (first !== undefined) joined.set(object.block, first[0]);
  }
  return joined;
}

function contains(box: Box, point: Point): boolean {
  return Math.abs(point.x - box.x) <= box.w / 2 && Math.abs(point.y - box.y) <= box.h / 2;
}

// The batch that ends a drag or a run of presses: core's change_stack for each
// stack that blocks join, and the DAG's change_position with every block and
// every stack without blocks that moved, as one step. It is empty where
// nothing moved. It names each command by the Id that the caller's core.id()
// gives.
export function movesBatch(
  canvas: Canvas,
  moves: Changes,
  core: Pick<CoreApi, "id">,
  joined: ReadonlyMap<BlockId, StackId> = new Map(),
): CommandCall[] {
  const positions = movedOnly(canvas.positions, moves.positions);
  const stacks = movedOnly(canvas.points, moves.points);
  const batch: CommandCall[] = [];
  for (const [stack, blocks] of joiningBlocks(canvas.board, joined)) {
    batch.push({ id: core.id("blockr.core", "change_stack"), args: { id: stack, blocks } });
  }
  if (Object.keys(positions).length > 0 || Object.keys(stacks).length > 0) {
    batch.push({ id: core.id("blockr.graph", "change_position"), args: { positions, stacks } });
  }
  return batch;
}

// The points of `moved` that differ from those of `from`, as JSON.
function movedOnly(from: Readonly<Record<string, Point>>, moved: Readonly<Record<string, Point>>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [id, point] of Object.entries(moved)) {
    const was = from[id];
    if (was?.x !== point.x || was.y !== point.y) out[id] = { x: point.x, y: point.y };
  }
  return out;
}

// The blocks of each stack that blocks join, as change_stack takes them: the
// stack's blocks, then those that join it, in the order of the board.
function joiningBlocks(board: Board, joined: ReadonlyMap<BlockId, StackId>): Map<StackId, BlockId[]> {
  const stacks = new Map<StackId, BlockId[]>();
  for (const block of Object.keys(board.blocks)) {
    const stack = joined.get(block);
    if (stack === undefined) continue;
    stacks.set(stack, [...(stacks.get(stack) ?? board.stacks[stack]?.blocks ?? []), block]);
  }
  return stacks;
}
