// The way that links run, which the DAG reads from where their blocks sit, so
// that a new block follows how the user arranged the blocks around it
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
//
// The DAG takes the mean offset between the positions of the two blocks of
// each link that a rule of placing names.
// Their axis is the layout's direction's, unless that mean is less than half
// a rank along it, as for blocks that the user put in a row across a board
// laid out from top to bottom, where the axis is the other one.
// Their way along the axis is the sign of the mean along it, and the layout's
// direction's where that is zero, as for two links that run opposite ways.
// So a link to a block one rank below and far to the side still runs down,
// as the links to blocks spread across a rank do.

import type { Link } from "@blockr/core";
import { boxOfBlock } from "../geometry/index.ts";
import type { Canvas } from "../geometry/index.ts";
import type { Layout } from "../state/index.ts";

export type Axis = "x" | "y";

// The way that links run: along an axis, towards larger x or y for 1, and
// towards smaller for -1.
export interface Way {
  readonly axis: Axis;
  readonly sign: 1 | -1;
}

// The axis along which the layout's direction runs.
function axisOf(direction: Layout["direction"]): Axis {
  return direction === "TB" ? "y" : "x";
}

// The way that the links run, over those whose two blocks have positions, or
// the layout's direction where none has.
export function wayOf(canvas: Canvas, links: readonly Link[], direction: Layout["direction"], gap: number): Way {
  const main = axisOf(direction);
  const offsets = links.flatMap((link) => {
    const [from, to] = [canvas.positions[link.from], canvas.positions[link.to]];
    const [a, b] = [boxOfBlock(canvas, link.from), boxOfBlock(canvas, link.to)];
    if (from === undefined || to === undefined || a === undefined || b === undefined) return [];
    // A rank along the main axis: half of the two nodes, and the gap.
    const rank = (main === "y" ? a.h + b.h : a.w + b.w) / 2 + gap;
    return [{ x: to.x - from.x, y: to.y - from.y, rank }];
  });
  if (offsets.length === 0) return { axis: main, sign: 1 };
  const mean = (of: (offset: (typeof offsets)[number]) => number) =>
    offsets.reduce((sum, offset) => sum + of(offset), 0) / offsets.length;
  const along = { x: mean((offset) => offset.x), y: mean((offset) => offset.y) };
  const axis: Axis = Math.abs(along[main]) < mean((offset) => offset.rank) / 2 ? (main === "y" ? "x" : "y") : main;
  return { axis, sign: along[axis] < 0 ? -1 : 1 };
}
