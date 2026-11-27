// The shape that the DAG draws an expanded stack as, in place of its box
// (https://github.com/BristolMyersSquibb/blockr.graph/issues/28): a rounded
// shape that holds each of the stack's blocks with STACK_PADDING around it,
// and covers as little else as it can.
//
// - Bubble Sets draw it (./vendor.ts). Around a block, the shape keeps the
//   padding, with round corners. Where two blocks of the stack sit close, it
//   swells between them. It reaches a block that sits apart from the others
//   through a narrow strip, which routes around the nodes that the stack does
//   not hold.
// - It keeps clear of every node that the canvas shows and the stack does not
//   hold, but for the nodes that a drag moves. So the shapes that a drag
//   passes over stay as they are while the user drags.
// - Where Bubble Sets find no shape, the shape is the stack's box.
// - The DAG tests the shape where a dropped block joins a stack
//   (../ui/moves.ts). Placing and making room test the boxes of the stack's
//   blocks, each with the padding, which the shape holds (../geometry).
//
// It reads nothing on the page. The DAG keeps the last shapes that it
// computed, by what each depends on, so that a drag computes again only the
// shapes of the stacks whose blocks it moves.

import type { StackId } from "@blockr/core";
import { bounds, boxOfBlock, canvasNodes, expandedBox, NO_CHANGES, overlaps, STACK_PADDING } from "../geometry/index.ts";
import type { Box, Canvas, CanvasNode, Changes } from "../geometry/index.ts";
import type { Point } from "../state/index.ts";
import { BubbleSets } from "./vendor.ts";

// A stack's shape: the corners of the polygon that bounds it, in order, on
// the canvas.
export interface Shape {
  readonly points: readonly Point[];
}

// How far from a block its pull on the shape reaches, and how far from a node
// that the stack does not hold that node pushes the shape back, as Bubble
// Sets' default. A node that keeps the smallest gap, 50 px, from the padding
// around a block then leaves the shape around the block as it is.
const REACH = 50;

// How far from the line between two blocks the strip that joins them reaches
// in full, and how far its pull reaches, as Bubble Sets' default.
const STRIP = 10;
const STRIP_REACH = 20;

// The size of the cells of the grid on which Bubble Sets find the shape, in
// pixels of the canvas, as Bubble Sets' default. Bubble Sets give each point
// of the shape at the top left corner of a square of four cells, which the
// shape crosses through its middle, so the DAG moves each point by half a
// cell along both axes. The shape then keeps 20 px around a block, to half a
// pixel, on every side, as at the corners.
const CELL = 4;

// Of the points that Bubble Sets give, the shape keeps every fourth, which
// keeps the corners round, and smooths the steps of the grid between them.
const SAMPLE = 4;

// How many shapes the DAG keeps.
const KEPT = 256;

const OPTIONS = {
  nodeR0: STACK_PADDING,
  nodeR1: REACH,
  edgeR0: STRIP,
  edgeR1: STRIP_REACH,
  morphBuffer: STACK_PADDING,
  pixelGroup: CELL,
};

// The shapes that the DAG computed last, by what each depends on.
const shapes = new Map<string, Shape>();

// The shape of the stack where it shows expanded, or undefined where it is
// collapsed, holds no block, or none of its blocks has a position. The moves
// of a drag name the nodes that the shape does not keep clear of.
export function stackShape(canvas: Canvas, stack: StackId, moving: Changes = NO_CHANGES): Shape | undefined {
  if (canvas.collapsed.has(stack) || canvas.points[stack] !== undefined) return undefined;
  const members = (canvas.board.stacks[stack]?.blocks ?? []).flatMap((block) => boxOfBlock(canvas, block) ?? []);
  const around = bounds(members);
  if (around === undefined) return undefined;
  const near = { ...around, w: around.w + 4 * REACH, h: around.h + 4 * REACH };
  const others = canvasNodes(canvas)
    .filter((node) => node.stack !== stack && !moves(canvas, node, moving) && overlaps(node.box, near))
    .map((node) => node.box);

  const key = JSON.stringify([members, others].map((boxes) => boxes.map(({ x, y, w, h }) => [x, y, w, h])));
  const kept = shapes.get(key);
  if (kept !== undefined) {
    shapes.delete(key);
    shapes.set(key, kept);
    return kept;
  }
  const shape = drawn(members, others) ?? boxShape(expandedBox(canvas, stack) ?? around);
  shapes.set(key, shape);
  if (shapes.size > KEPT) shapes.delete(shapes.keys().next().value ?? key);
  return shape;
}

// Whether the point lies inside the shape.
export function withinShape(shape: Shape, point: Point): boolean {
  let inside = false;
  const { points } = shape;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [a, b] = [points[i], points[j]];
    if (a === undefined || b === undefined || a.y > point.y === b.y > point.y) continue;
    if (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// The SVG path of the shape, from the origin given.
export function shapePath(shape: Shape, origin: Point): string {
  const at = (value: number) => String(Math.round(value * 10) / 10);
  const points = shape.points.map((point) => `${at(point.x - origin.x)},${at(point.y - origin.y)}`);
  return points.length === 0 ? "" : `M${points.join("L")}Z`;
}

// Whether the moves of a drag move the node: a block, a stack that holds no
// block, or a collapsed stack, whose blocks move with it.
function moves(canvas: Canvas, node: CanvasNode, moving: Changes): boolean {
  if (node.kind === "block") return Object.hasOwn(moving.positions, node.id);
  if (Object.hasOwn(moving.points, node.id)) return true;
  return (canvas.board.stacks[node.id]?.blocks ?? []).some((block) => Object.hasOwn(moving.positions, block));
}

// The shape that Bubble Sets draw around the members, clear of the others, or
// undefined where they find none.
function drawn(members: readonly Box[], others: readonly Box[]): Shape | undefined {
  const rect = (box: Box) => ({ x: box.x - box.w / 2, y: box.y - box.h / 2, width: box.w, height: box.h });
  const sets = new BubbleSets(OPTIONS);
  sets.pushMember(...members.map(rect));
  sets.pushNonMember(...others.map(rect));
  const path = sets.compute().sample(SAMPLE).simplify(0).bSplines().simplify(0);
  return path.length < 3 ? undefined : { points: path.points.map(({ x, y }) => ({ x: x + CELL / 2, y: y + CELL / 2 })) };
}

// The shape of a box: its corners.
function boxShape(box: Box): Shape {
  const [left, right, top, bottom] = [box.x - box.w / 2, box.x + box.w / 2, box.y - box.h / 2, box.y + box.h / 2];
  return {
    points: [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
  };
}
