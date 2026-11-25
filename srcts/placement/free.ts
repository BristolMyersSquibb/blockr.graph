// Where what a paste or a board action adds lands, from the point at which the
// user pastes or adds it: at the spot nearest the point at which it keeps the
// spacing's gap from every node and every stack's box that the canvas shows
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
// So no block lands on another, or in the box of a stack that does not hold
// it, and nothing has to make room for it.
//
// The DAG tries offsets on a grid, nearest first, and keeps the first at which
// every box of what lands is free. The grid's step is the snap size while
// snapping is on, so that the spot snaps where it lies, and STEP otherwise.
// Where no spot within REACH is free, what lands stays at the point, and the
// placement strategy fits it in as it fits in any addition.

import { canvasNodes, expandedBox, gapOf, overlaps, shifted } from "../geometry/index.ts";
import type { Box, Canvas } from "../geometry/index.ts";
import type { Layout, Point } from "../state/index.ts";

// The grid's step while snapping is off, and how far from the point the spot
// may lie, in pixels of the canvas.
const STEP = 10;
const REACH = 1000;

// The boxes that the canvas shows: the box of every node, and of every
// expanded stack, whose blocks are nodes of their own.
export function shownBoxes(canvas: Canvas): Box[] {
  const boxes = canvasNodes(canvas).map((node) => node.box);
  for (const stack of Object.keys(canvas.board.stacks)) {
    if (canvas.collapsed.has(stack) || canvas.points[stack] !== undefined) continue;
    const box = expandedBox(canvas, stack);
    if (box !== undefined) boxes.push(box);
  }
  return boxes;
}

// The offset nearest to none by which the boxes given, moved, keep the gap of
// the layout's spacing from every box that the canvas shows, or none where no
// offset within REACH does.
export function freeOffset(canvas: Canvas, boxes: readonly Box[], layout: Layout): Point {
  const taken = shownBoxes(canvas);
  const gap = gapOf(layout.spacing);
  const free = ({ x, y }: Point): boolean =>
    boxes.every((box) => {
      const moved = shifted(box, x, y);
      return taken.every((other) => !overlaps(moved, other, gap));
    });
  const none = { x: 0, y: 0 };
  if (boxes.length === 0 || free(none)) return none;
  return offsets(layout.snap ? layout.snap_size : STEP).find(free) ?? none;
}

// The offsets of the grid of the step given within REACH, nearest first, and
// among those as near, in the order of the rows from the top.
function offsets(step: number): Point[] {
  const rings = Math.ceil(REACH / step);
  const grid: Point[] = [];
  for (let j = -rings; j <= rings; j++) {
    for (let i = -rings; i <= rings; i++) grid.push({ x: i * step, y: j * step });
  }
  return grid.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
}
