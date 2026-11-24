// Snapping, which rounds each position that the DAG sets while `snap` is on
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#how-the-dag-moves-blocks).
// A position that someone gives only rounds, so that a block lands on the
// multiple of the snap size nearest where it was dropped.
// A position that one of the DAG's operations gives rounds too, which moves
// the node by up to half of the snap size. Where that brings the node closer
// to another node than the gap, the node moves on to the nearest multiple
// of the snap size that keeps the gap. A node that sat closer than the gap
// already keeps what it had.

import type { BlockId, StackId } from "@blockr/core";
import type { Layout, Point } from "../state/index.ts";
import { overlaps } from "./box.ts";
import type { Box } from "./box.ts";
import { blockBox, canvasNodes, changed, stackBoxAt } from "./canvas.ts";
import type { Canvas, Changes } from "./canvas.ts";
import { gapOf } from "./sizes.ts";

// The point with each coordinate rounded to a multiple of the snap size.
export function snapPoint(point: Point, size: number): Point {
  return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size };
}

// How far from where the operation put a node snapping looks for a multiple
// that keeps the gap, in multiples of the snap size along each axis.
const REACH = 4;

// The changes of one of the DAG's operations on the canvas, snapped where the
// layout has `snap` on, and as they are where it is off.
// The canvas is the one before the changes.
// A node that moves as one with a collapsed stack only rounds, since its
// blocks move together.
export function snapChanges(canvas: Canvas, changes: Changes, layout: Layout): Changes {
  if (!layout.snap) return changes;
  const size = layout.snap_size;
  const gap = gapOf(layout.spacing);
  const positions: Record<BlockId, Point> = {};
  const points: Record<StackId, Point> = {};
  for (const [id, point] of Object.entries(changes.positions)) positions[id] = snapPoint(point, size);
  for (const [id, point] of Object.entries(changes.points)) points[id] = snapPoint(point, size);

  const nodes = canvasNodes(changed(canvas, { positions, points }));
  const boxes = nodes.map((node) => node.box);
  for (const [i, node] of nodes.entries()) {
    const raw = node.kind === "block" ? changes.positions[node.id] : changes.points[node.id];
    if (raw === undefined) continue;
    const name = canvas.board.blocks[node.id]?.name ?? "";
    const boxAt = (point: Point): Box => (node.kind === "block" ? blockBox(point, name) : stackBoxAt(point));
    const unsnapped = boxAt(raw);
    const tooClose = (box: Box) =>
      boxes.some((other, j) => j !== i && overlaps(box, other, gap) && !overlaps(unsnapped, other, gap));
    if (!tooClose(boxes[i] ?? unsnapped)) continue;
    const spot = multiplesNear(raw, size).find((point) => !tooClose(boxAt(point)));
    if (spot === undefined) continue;
    boxes[i] = boxAt(spot);
    if (node.kind === "block") positions[node.id] = spot;
    else points[node.id] = spot;
  }
  return { positions, points };
}

// The multiples of the snap size around the point, nearest first, and of two
// as near, the one further up, then the one further left.
function multiplesNear(point: Point, size: number): Point[] {
  const [x0, y0] = [Math.floor(point.x / size), Math.floor(point.y / size)];
  const spots: Point[] = [];
  for (let i = -REACH; i <= REACH + 1; i++) {
    for (let j = -REACH; j <= REACH + 1; j++) spots.push({ x: (x0 + i) * size, y: (y0 + j) * size });
  }
  const far = (spot: Point) => (spot.x - point.x) ** 2 + (spot.y - point.y) ** 2;
  return spots.sort((a, b) => far(a) - far(b) || a.y - b.y || a.x - b.x);
}
