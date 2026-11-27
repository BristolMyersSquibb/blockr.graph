// Beside, the placement that moves what a step adds on together, keeping how
// it sits, to the nearest spot where no added node overlaps another node that
// shows, or the padding around a block of a stack that it is not in, which
// the stack's shape holds, with the spacing's gap around it, and moves no
// other block
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
// It looks for the spot in rings around where what the step adds starts, one
// gap apart, and takes the first spot where no added node overlaps another
// node, so that the same step on the same board lands in the same place.
// Within a ring, it tries the nearer spots first, and of two as near, the one
// further up, then the one further left.

import { canvasNodes, nodeChanges, overlaps, padded, shifted, STACK_PADDING } from "../geometry/index.ts";
import type { Box, Canvas, CanvasNode, Changes } from "../geometry/index.ts";
import type { Added } from "../room/index.ts";

// How many rings Beside looks in before it leaves what the step adds where
// it starts.
const RINGS = 40;

// The changes that move what the step adds, on a canvas where it has started,
// to the nearest free spot.
export function beside(canvas: Canvas, added: Added, gap: number): Changes {
  const nodes = canvasNodes(canvas);
  const isAdded = (node: CanvasNode) => (node.kind === "block" ? added.blocks : added.stacks).has(node.id);
  const group = nodes.filter(isAdded);
  const others = nodes.filter((node) => !isAdded(node)).map((node) => node.box);
  const stacks = stackBoxes(canvas, nodes, isAdded);
  const fits = (dx: number, dy: number) =>
    group.every((node) => {
      const box = shifted(node.box, dx, dy);
      return (
        others.every((other) => !overlaps(box, other, gap)) &&
        stacks.every(([stack, other]) => stack === node.stack || !overlaps(box, other, gap))
      );
    });

  for (const [dx, dy] of rings(gap)) {
    if (!fits(dx, dy)) continue;
    const positions = {};
    const points = {};
    if (dx === 0 && dy === 0) return { positions, points };
    for (const node of group) {
      const changes = nodeChanges(canvas, node, shifted(node.box, dx, dy));
      Object.assign(positions, changes.positions);
      Object.assign(points, changes.points);
    }
    return { positions, points };
  }
  return { positions: {}, points: {} };
}

// The box of each block of an expanded stack that the step did not add, with
// the padding, each with the stack's id.
function stackBoxes(canvas: Canvas, nodes: readonly CanvasNode[], isAdded: (node: CanvasNode) => boolean): [string, Box][] {
  return nodes.flatMap((node): [string, Box][] => {
    if (node.kind !== "block" || node.stack === null || isAdded(node) || canvas.collapsed.has(node.stack)) return [];
    return [[node.stack, padded(node.box, STACK_PADDING)]];
  });
}

// The offsets of the spots, ring by ring, each ring one step further out.
function* rings(step: number): Generator<[number, number]> {
  yield [0, 0];
  for (let ring = 1; ring <= RINGS; ring++) {
    const spots: [number, number][] = [];
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) if (Math.max(Math.abs(i), Math.abs(j)) === ring) spots.push([i, j]);
    }
    spots.sort(([i1, j1], [i2, j2]) => i1 ** 2 + j1 ** 2 - (i2 ** 2 + j2 ** 2) || j1 - j2 || i1 - i2);
    for (const [i, j] of spots) yield [i * step, j * step];
  }
}
