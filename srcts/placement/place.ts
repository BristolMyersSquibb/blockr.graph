// Placing what a step adds, one block or stack or many, in one go, whoever
// adds it (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks):
//
// 1. Each of them starts where the step puts it, and otherwise where the
//    strategy starts it (./start.ts).
// 2. The placement strategy then fits them all in at once: Repulsion keeps
//    them where they start and makes room around them, and Beside moves them
//    on together, so that none of them overlaps another node (./beside.ts).
// 3. While `snap` is on, every position that placing sets snaps.

import type { BlockId } from "@blockr/core";
import { changed, gapOf, merged, snapChanges } from "../geometry/index.ts";
import type { Canvas, Changes } from "../geometry/index.ts";
import { makeRoom } from "../room/index.ts";
import type { Added } from "../room/index.ts";
import type { Layout } from "../state/index.ts";
import { beside } from "./beside.ts";
import { startPoints } from "./start.ts";

// The changes that place what the step adds on the canvas that it leaves:
// where the added blocks and stacks go, and under Repulsion, where the nodes
// that make room for them go. The set `moved` names the blocks that the step
// moves, which stay where it puts them. The placement is the layout's unless
// given, as the class's start places what a board lacks as Beside does.
export function placeAdded(
  canvas: Canvas,
  added: Added,
  moved: ReadonlySet<BlockId>,
  layout: Layout,
  placement: Layout["placement"] = layout.placement,
): Changes {
  const gap = gapOf(layout.spacing);
  const starts = startPoints(canvas, added, layout);
  const started = changed(canvas, starts);
  const fit = placement === "beside" ? beside(started, added, gap) : makeRoom(started, added, moved, gap);
  return snapChanges(canvas, merged(starts, fit), layout);
}
