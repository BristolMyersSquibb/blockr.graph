// Where each block and each stack that holds no block that a step adds
// starts, where the step gives it no place
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
// Both strategies start them alike, by the links of the board that the step
// leaves, so that a new block joins the blocks around it in the way their
// links already run:
//
// 1. An inserted block, which reads from one block and feeds another, starts
//    between the two.
// 2. Where the blocks that it reads from already feed other blocks, a block
//    starts one gap past the last of those, level with it: to the right of
//    the rightmost of them where their links run up or down, and below the
//    lowest of them where their links run across.
// 3. Where the blocks that it reads from feed no other block yet, it starts
//    one rank past them, across from their middle, in the way that the links
//    into them run.
// 4. A block that reads from none but feeds others starts in the same way
//    upstream: one gap past the last of the other blocks that feed the blocks
//    it feeds, and where none does, one rank before the blocks it feeds,
//    against the way that the links out of them run.
// 5. A block linked to none starts after the last block of the first rank,
//    the nodes level with the topmost from top to bottom, or with the
//    leftmost from left to right, and at the canvas's origin on a canvas
//    without nodes.
// 6. A stack that holds no block starts as a block linked to none, with the
//    size of its box.
//
// Several that one step adds start in the order of their links, blocks
// first, each against those that start before it, and off the ones that it
// would overlap, so that a new chain comes out as a chain.
// Each reads only the blocks that have positions, those that start before it
// among them.

import type { BlockId, Board, Link, StackId } from "@blockr/core";
import {
  BLOCK_HEIGHT,
  blockWidth,
  bounds,
  boxOfBlock,
  canvasNodes,
  changed,
  gapOf,
  overlaps,
  STACK_HEIGHT,
  STACK_WIDTH,
  stackBoxAt,
} from "../geometry/index.ts";
import type { Box, Canvas, Changes } from "../geometry/index.ts";
import type { Added } from "../room/index.ts";
import type { Layout, Point } from "../state/index.ts";
import { wayOf } from "./ways.ts";
import type { Way } from "./ways.ts";

// The size of what starts, which starts centred at its point.
interface Shape {
  readonly w: number;
  readonly h: number;
}

function blockShape(name: string): Shape {
  return { w: blockWidth(name), h: BLOCK_HEIGHT };
}

const STACK_SHAPE: Shape = { w: STACK_WIDTH, h: STACK_HEIGHT };

// The points where what the step adds starts: the positions of the added
// blocks and of the added stacks that hold no block, but for those that the
// canvas gives a position already, which start there.
export function startPoints(canvas: Canvas, added: Added, layout: Layout): Changes {
  const gap = gapOf(layout.spacing);
  const positions: Record<BlockId, Point> = {};
  const points: Record<StackId, Point> = {};
  let current = canvas;
  // The boxes of what the step adds that has a place: what the step gives
  // one first, then each in the order that it starts.
  const placed: Box[] = [];
  for (const block of added.blocks) {
    const box = boxOfBlock(canvas, block);
    if (box !== undefined) placed.push(box);
  }
  for (const stack of added.stacks) {
    const point = canvas.points[stack];
    if (point !== undefined) placed.push(stackBoxAt(point));
  }
  const start = (box: Box): Point => {
    const free = offPlaced(box, placed, layout.direction, gap);
    placed.push(free);
    return { x: free.x, y: free.y };
  };

  for (const block of linkOrder(canvas.board, added.blocks)) {
    if (canvas.positions[block] !== undefined) continue;
    const shape = blockShape(canvas.board.blocks[block]?.name ?? "");
    const point = start(startBox(current, block, shape, layout, gap));
    positions[block] = point;
    current = changed(current, { positions: { [block]: point }, points: {} });
  }
  for (const stack of Object.keys(canvas.board.stacks)) {
    if (!added.stacks.has(stack) || canvas.points[stack] !== undefined) continue;
    const point = start(firstRank(current, STACK_SHAPE, layout, gap));
    points[stack] = point;
    current = changed(current, { positions: {}, points: { [stack]: point } });
  }
  return { positions, points };
}

// The box in which a block starts, by its links to blocks that have
// positions.
function startBox(canvas: Canvas, block: BlockId, shape: Shape, layout: Layout, gap: number): Box {
  const links = Object.values(canvas.board.links);
  const has = (id: BlockId) => canvas.positions[id] !== undefined && id !== block;
  const sources = unique(links.flatMap((link) => (link.to === block && has(link.from) ? [link.from] : [])));
  const targets = unique(links.flatMap((link) => (link.from === block && has(link.to) ? [link.to] : [])));
  const way = (of: readonly Link[]) => wayOf(canvas, of, layout.direction, gap);

  const [source] = sources;
  const [target] = targets;
  if (sources.length === 1 && targets.length === 1 && source !== undefined && target !== undefined) {
    return between(canvas, source, target, shape);
  }
  if (sources.length > 0) {
    const fed = links.filter((link) => sources.includes(link.from) && has(link.to));
    if (fed.length > 0) return pastLast(canvas, fed.map((link) => link.to), way(fed), shape, gap);
    const into = links.filter((link) => sources.includes(link.to) && has(link.from));
    return rankPast(canvas, sources, way(into), 1, shape, gap);
  }
  if (targets.length > 0) {
    const feeding = links.filter((link) => targets.includes(link.to) && has(link.from));
    if (feeding.length > 0) return pastLast(canvas, feeding.map((link) => link.from), way(feeding), shape, gap);
    const out = links.filter((link) => targets.includes(link.from) && has(link.to));
    return rankPast(canvas, targets, way(out), -1, shape, gap);
  }
  return firstRank(canvas, shape, layout, gap);
}

// Between two blocks: centred midway between their nodes.
function between(canvas: Canvas, from: BlockId, to: BlockId, shape: Shape): Box {
  const [a, b] = [boxOfBlock(canvas, from), boxOfBlock(canvas, to)];
  if (a === undefined || b === undefined) return { x: 0, y: 0, w: shape.w, h: shape.h };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: shape.w, h: shape.h };
}

// One gap past the last of the blocks, level with it: to the right of the
// rightmost where the links run up or down, and below the lowest where they
// run across.
function pastLast(canvas: Canvas, blocks: readonly BlockId[], way: Way, shape: Shape, gap: number): Box {
  const boxes = unique(blocks).flatMap((block) => boxOfBlock(canvas, block) ?? []);
  if (way.axis === "y") {
    const last = lastBy(boxes, (box) => box.x + box.w / 2);
    return { x: last.x + last.w / 2 + gap + shape.w / 2, y: last.y, w: shape.w, h: shape.h };
  }
  const last = lastBy(boxes, (box) => box.y + box.h / 2);
  return { x: last.x, y: last.y + last.h / 2 + gap + shape.h / 2, w: shape.w, h: shape.h };
}

// One rank past the blocks, across from their middle, in the way given, or
// against it for -1.
function rankPast(canvas: Canvas, blocks: readonly BlockId[], way: Way, against: 1 | -1, shape: Shape, gap: number): Box {
  const span = bounds(blocks.flatMap((block) => boxOfBlock(canvas, block) ?? [])) ?? { x: 0, y: 0, w: shape.w, h: shape.h };
  const ahead = way.sign * against > 0;
  if (way.axis === "y") {
    const y = ahead ? span.y + span.h / 2 + gap + shape.h / 2 : span.y - span.h / 2 - gap - shape.h / 2;
    return { x: span.x, y, w: shape.w, h: shape.h };
  }
  const x = ahead ? span.x + span.w / 2 + gap + shape.w / 2 : span.x - span.w / 2 - gap - shape.w / 2;
  return { x, y: span.y, w: shape.w, h: shape.h };
}

// After the last node of the first rank: the nodes level with the topmost,
// from top to bottom, or with the leftmost, from left to right. On a canvas
// without nodes, at the origin.
function firstRank(canvas: Canvas, shape: Shape, layout: Layout, gap: number): Box {
  const boxes = canvasNodes(canvas).map((node) => node.box);
  const [first] = boxes;
  if (first === undefined) return { x: 0, y: 0, w: shape.w, h: shape.h };
  if (layout.direction === "TB") {
    const top = Math.min(...boxes.map((box) => box.y));
    const last = lastBy(boxes.filter((box) => box.y - top < gap / 2), (box) => box.x + box.w / 2);
    return { x: last.x + last.w / 2 + gap + shape.w / 2, y: top, w: shape.w, h: shape.h };
  }
  const left = Math.min(...boxes.map((box) => box.x));
  const last = lastBy(boxes.filter((box) => box.x - left < gap / 2), (box) => box.y + box.h / 2);
  return { x: left, y: last.y + last.h / 2 + gap + shape.h / 2, w: shape.w, h: shape.h };
}

// The box moved off each box placed before that it would overlap, with the
// gap around it: past it, to the right from top to bottom, or below it from
// left to right.
function offPlaced(box: Box, placed: readonly Box[], direction: Layout["direction"], gap: number): Box {
  let moved = box;
  for (let tries = 0; tries <= placed.length; tries++) {
    const hit = placed.find((other) => overlaps(moved, other, gap));
    if (hit === undefined) return moved;
    moved =
      direction === "TB"
        ? { ...moved, x: hit.x + hit.w / 2 + gap + moved.w / 2 }
        : { ...moved, y: hit.y + hit.h / 2 + gap + moved.h / 2 };
  }
  return moved;
}

// The blocks given in the order of their links: each after the blocks among
// them that it reads from, and otherwise in the order that the board holds
// them.
export function linkOrder(board: Board, blocks: ReadonlySet<BlockId>): BlockId[] {
  const order = Object.keys(board.blocks).filter((block) => blocks.has(block));
  const reads = new Map<BlockId, BlockId[]>();
  for (const link of Object.values(board.links)) {
    if (link.from === link.to || !blocks.has(link.from) || !blocks.has(link.to)) continue;
    reads.set(link.to, [...(reads.get(link.to) ?? []), link.from]);
  }
  const done = new Set<BlockId>();
  const ordered: BlockId[] = [];
  while (ordered.length < order.length) {
    const left = order.filter((block) => !done.has(block));
    const next = left.find((block) => (reads.get(block) ?? []).every((from) => done.has(from))) ?? left[0];
    if (next === undefined) break;
    done.add(next);
    ordered.push(next);
  }
  return ordered;
}

// The last of the boxes by the measure, the first of those that tie.
function lastBy(boxes: readonly Box[], measure: (box: Box) => number): Box {
  let last: Box | undefined;
  for (const box of boxes) if (last === undefined || measure(box) > measure(last)) last = box;
  return last ?? { x: 0, y: 0, w: 0, h: 0 };
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
