// The criteria that the spike checked making room against, fixed before it
// ran (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3, notes),
// as checks of two canvases: the one before the DAG made room, and the one
// after.

import { canvasNodes, distance, expandedBox, overlaps } from "../geometry/index.ts";
import type { Canvas, CanvasNode } from "../geometry/index.ts";
import type { Point } from "../state/index.ts";

const key = (node: CanvasNode) => `${node.kind}:${node.id}`;

// The pairs of nodes that come within the gap of each other on the canvas
// after, but did not on the canvas before, each as two keys, "block:a" and
// "stack:s". A node that the canvas before lacks counts as one that sat
// apart.
export function newlyClose(before: Canvas, after: Canvas, gap: number): [string, string][] {
  const was = new Map(canvasNodes(before).map((node) => [key(node), node.box]));
  const nodes = canvasNodes(after);
  const pairs: [string, string][] = [];
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      if (!overlaps(a.box, b.box, gap - 0.5)) continue;
      const [a0, b0] = [was.get(key(a)), was.get(key(b))];
      if (a0 !== undefined && b0 !== undefined && overlaps(a0, b0, gap - 0.5)) continue;
      pairs.push([key(a), key(b)]);
    }
  }
  return pairs;
}

// The pairs of nodes within two gaps of each other on the canvas before that
// swap sides along an axis along which they sat at least half a gap apart:
// one that sat left of the other, or above it, no longer does.
export function swapped(before: Canvas, after: Canvas, gap: number): [string, string][] {
  const now = new Map(canvasNodes(after).map((node) => [key(node), node.box]));
  const nodes = canvasNodes(before).filter((node) => now.has(key(node)));
  const pairs: [string, string][] = [];
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      if (distance(a.box, b.box) >= 2 * gap) continue;
      const [a1, b1] = [now.get(key(a)), now.get(key(b))];
      if (a1 === undefined || b1 === undefined) continue;
      const flips = (["x", "y"] as const).some((axis) => {
        const [was, is] = [b.box[axis] - a.box[axis], b1[axis] - a1[axis]];
        return Math.abs(was) >= gap / 2 && was * is < 0 && Math.abs(is) >= 0.5;
      });
      if (flips) pairs.push([key(a), key(b)]);
    }
  }
  return pairs;
}

// The nodes that lie in the box of an expanded stack that they are not in,
// or closer to it than the gap, each as its key and the stack's id.
export function intruders(canvas: Canvas, gap = 0): [string, string][] {
  const nodes = canvasNodes(canvas);
  return Object.keys(canvas.board.stacks).flatMap((stack) => {
    const box = canvas.collapsed.has(stack) ? undefined : expandedBox(canvas, stack);
    if (box === undefined) return [];
    return nodes.filter((node) => node.stack !== stack && overlaps(node.box, box, gap)).map((node): [string, string] => [key(node), stack]);
  });
}

// The furthest that a block of the board sits on the second canvas from
// where it sits on the first.
export function furthest(first: Readonly<Record<string, Point>>, second: Readonly<Record<string, Point>>, ids: readonly string[]): number {
  return Math.max(
    0,
    ...ids.map((id) => {
      const [a, b] = [first[id], second[id]];
      return a === undefined || b === undefined ? 0 : Math.hypot(a.x - b.x, a.y - b.y);
    }),
  );
}
