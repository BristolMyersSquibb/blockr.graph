// Where the board's blocks and stacks sit on the canvas, as the DAG's state
// gives it, and the nodes that the DAG shows there, each with its box
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#nodes).
// Placing, making room and laying out all work from these boxes.
//
// - A block's node is its mark with its name below it, centred at the
//   block's position.
// - A stack's box fits its blocks, with STACK_PADDING around them.
// - A collapsed stack shows as a box of its own size, centred where its
//   expanded box is, and its blocks hide.
// - A stack that holds no block shows as a box of the same size, centred at
//   its position.

import type { BlockId, Board, StackId } from "@blockr/core";
import { isCollapse } from "../state/index.ts";
import type { GraphState, Point } from "../state/index.ts";
import { bounds, padded } from "./box.ts";
import type { Box } from "./box.ts";
import { BLOCK_HEIGHT, blockWidth, STACK_HEIGHT, STACK_PADDING, STACK_WIDTH } from "./sizes.ts";

// The board with where its blocks and stacks sit.
export interface Canvas {
  readonly board: Board;
  // The positions of blocks, which may lack some blocks of the board and
  // hold some that the board lacks.
  readonly positions: Readonly<Record<BlockId, Point>>;
  // The positions of the stacks of the board that hold no block.
  readonly points: Readonly<Record<StackId, Point>>;
  // The stacks of the board with blocks that the DAG shows collapsed.
  readonly collapsed: ReadonlySet<StackId>;
}

// The canvas of the board, from the DAG's state on it.
// An entry in `stacks` counts only where the board holds its stack, and only
// where it fits it: a position for a stack that holds no block, and a
// collapse for one with blocks.
export function canvasOf(board: Board, state: GraphState): Canvas {
  const points: Record<StackId, Point> = {};
  const collapsed = new Set<StackId>();
  for (const [id, entry] of Object.entries(state.stacks)) {
    const stack = board.stacks[id];
    if (stack === undefined) continue;
    if (isCollapse(entry)) {
      if (stack.blocks.length > 0) collapsed.add(id);
    } else if (stack.blocks.length === 0) {
      points[id] = entry;
    }
  }
  return { board, positions: state.positions, points, collapsed };
}

// The stack that holds each block, by the block's id.
export function stackOf(board: Board): ReadonlyMap<BlockId, StackId> {
  const held = new Map<BlockId, StackId>();
  for (const [id, stack] of Object.entries(board.stacks)) {
    for (const block of stack.blocks) if (!held.has(block)) held.set(block, id);
  }
  return held;
}

// The box of a block's node, centred at the point.
export function blockBox(point: Point, name: string): Box {
  return { x: point.x, y: point.y, w: blockWidth(name), h: BLOCK_HEIGHT };
}

// The box of a collapsed stack or of a stack that holds no block, centred
// at the point.
export function stackBoxAt(point: Point): Box {
  return { x: point.x, y: point.y, w: STACK_WIDTH, h: STACK_HEIGHT };
}

// The box of a block of the board where the canvas places it, or undefined
// where it has no position.
export function boxOfBlock(canvas: Canvas, block: BlockId): Box | undefined {
  const point = canvas.positions[block];
  const name = canvas.board.blocks[block]?.name;
  return point === undefined || name === undefined ? undefined : blockBox(point, name);
}

// The box of a stack with blocks, expanded: the box of its blocks that have
// a position, with STACK_PADDING around them, or undefined where none has.
export function expandedBox(canvas: Canvas, stack: StackId): Box | undefined {
  const blocks = canvas.board.stacks[stack]?.blocks ?? [];
  const box = bounds(blocks.flatMap((block) => boxOfBlock(canvas, block) ?? []));
  return box === undefined ? undefined : padded(box, STACK_PADDING);
}

// The box of a stack as the DAG shows it: the box of a collapsed stack,
// centred where its expanded box is, the expanded box of a stack with
// blocks, or the box at the position of a stack that holds no block.
// It is undefined where the stack has nowhere to show.
export function shownBox(canvas: Canvas, stack: StackId): Box | undefined {
  const point = canvas.points[stack];
  if (point !== undefined) return stackBoxAt(point);
  const box = expandedBox(canvas, stack);
  return box === undefined || !canvas.collapsed.has(stack) ? box : stackBoxAt(box);
}

// A node that the DAG shows: a block in no stack or in an expanded stack, or
// a stack that shows as one box, collapsed or holding no block. Making room
// takes an expanded stack as one node too, of its expanded box.
export interface CanvasNode {
  readonly kind: "block" | "stack";
  // The id of the block or of the stack.
  readonly id: string;
  readonly box: Box;
  // For a block, the stack that holds it, whose box holds its node, or null
  // for none. For a stack, the stack itself.
  readonly stack: StackId | null;
}

// The nodes that the DAG shows, blocks first, each in the order that the
// board holds them, then stacks: every block with a position but those of
// collapsed stacks, each collapsed stack whose blocks have positions, and
// each stack that holds no block and has a position.
export function canvasNodes(canvas: Canvas): CanvasNode[] {
  const held = stackOf(canvas.board);
  const nodes: CanvasNode[] = [];
  for (const block of Object.keys(canvas.board.blocks)) {
    const stack = held.get(block) ?? null;
    const box = boxOfBlock(canvas, block);
    if (box === undefined || (stack !== null && canvas.collapsed.has(stack))) continue;
    nodes.push({ kind: "block", id: block, box, stack });
  }
  for (const stack of Object.keys(canvas.board.stacks)) {
    if (!canvas.collapsed.has(stack) && canvas.points[stack] === undefined) continue;
    const box = shownBox(canvas, stack);
    if (box !== undefined) nodes.push({ kind: "stack", id: stack, box, stack });
  }
  return nodes;
}

// What moving nodes sets: the positions of blocks, and of stacks that hold no
// block.
export interface Changes {
  readonly positions: Readonly<Record<BlockId, Point>>;
  readonly points: Readonly<Record<StackId, Point>>;
}

// The changes that move nothing.
export const NO_CHANGES: Changes = { positions: {}, points: {} };

// The positions that moving the node to the box sets: the block's, or for a
// stack with blocks, collapsed or expanded, those of its blocks, which move
// with it by one distance, or for a stack that holds no block, its own.
export function nodeChanges(canvas: Canvas, node: CanvasNode, box: Box): Changes {
  const point = { x: box.x, y: box.y };
  if (node.kind === "block") return { positions: { [node.id]: point }, points: {} };
  if (canvas.points[node.id] !== undefined) return { positions: {}, points: { [node.id]: point } };
  const [dx, dy] = [box.x - node.box.x, box.y - node.box.y];
  const positions: Record<BlockId, Point> = {};
  for (const block of canvas.board.stacks[node.id]?.blocks ?? []) {
    const point = canvas.positions[block];
    if (point !== undefined) positions[block] = { x: point.x + dx, y: point.y + dy };
  }
  return { positions, points: {} };
}

// The canvas with the changes made.
export function changed(canvas: Canvas, changes: Changes): Canvas {
  return {
    ...canvas,
    positions: { ...canvas.positions, ...changes.positions },
    points: { ...canvas.points, ...changes.points },
  };
}

// The changes of both, those of `later` winning.
export function merged(first: Changes, later: Changes): Changes {
  return { positions: { ...first.positions, ...later.positions }, points: { ...first.points, ...later.points } };
}
