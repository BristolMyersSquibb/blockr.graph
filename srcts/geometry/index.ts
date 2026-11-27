// The nominal sizes of the DAG's nodes, their boxes on the canvas, and
// snapping, from which placing, making room and laying out work.

export { apart, bounds, distance, overlaps, padded, shifted } from "./box.ts";
export type { Box } from "./box.ts";
export {
  blockBox,
  boxOfBlock,
  canvasNodes,
  canvasOf,
  changed,
  expandedBox,
  merged,
  NO_CHANGES,
  nodeChanges,
  paddedBoxes,
  shownBox,
  stackBoxAt,
  stackOf,
} from "./canvas.ts";
export type { Canvas, CanvasNode, Changes } from "./canvas.ts";
export { BLOCK_HEIGHT, blockWidth, gapOf, MARK, STACK_HEIGHT, STACK_PADDING, STACK_WIDTH } from "./sizes.ts";
export { snapChanges, snapPoint } from "./snap.ts";
