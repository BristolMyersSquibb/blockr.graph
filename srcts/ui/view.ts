// The zoom and the pan of the DAG's canvas, which the DAG keeps for the page,
// by the board's id, and restores as it mounts again on the same board, as
// when the dock draws a view again
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-canvas).
// They stay out of the DAG's state, since what one user looks at is no part of
// the board.

import { getViewportForBounds } from "../flow/index.ts";
import type { Viewport } from "../flow/index.ts";
import { bounds, canvasNodes, shownBox } from "../geometry/index.ts";
import type { Box, Canvas } from "../geometry/index.ts";

const views = new Map<string, Viewport>();

// The zoom and the pan that the DAG left on the board, or undefined where it
// has not drawn the board on this page yet.
export function savedView(board: string): Viewport | undefined {
  return views.get(board);
}

export function saveView(board: string, view: Viewport): void {
  views.set(board, { x: view.x, y: view.y, zoom: view.zoom });
}

// The zooms between which the user zooms the canvas.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

// The most that the DAG zooms in as it fits the view to the board, so that no
// block shows larger than its size.
export const FIT_ZOOM = 1;

// The room that a fit leaves around the board, on the canvas: more on the
// left, where the toolbar floats.
const FIT_PADDING = { top: "36px", right: "24px", bottom: "24px", left: "60px" } as const;

// How tall the name of a stack is, which sits above the stack's box.
const STACK_NAME = 20;

// The view that fits the board into a canvas of the size given, at most at
// FIT_ZOOM, or undefined where nothing on the board has a position.
// The DAG works it out from the boxes of the nodes, as it draws them, rather
// than through React Flow's fitView(), which waits for React Flow's next
// change of the nodes where the DAG gives React Flow its nodes.
export function fittedView(canvas: Canvas, size: { readonly width: number; readonly height: number }): Viewport | undefined {
  const boxes: Box[] = canvasNodes(canvas).map((node) => node.box);
  for (const stack of Object.keys(canvas.board.stacks)) {
    const box = shownBox(canvas, stack);
    if (box !== undefined) boxes.push({ ...box, y: box.y - STACK_NAME / 2, h: box.h + STACK_NAME });
  }
  const box = bounds(boxes);
  if (box === undefined || size.width === 0 || size.height === 0) return undefined;
  const rect = { x: box.x - box.w / 2, y: box.y - box.h / 2, width: box.w, height: box.h };
  return getViewportForBounds(rect, size.width, size.height, MIN_ZOOM, FIT_ZOOM, FIT_PADDING);
}
