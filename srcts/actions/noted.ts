// What the DAG's UI notes for the DAG's board actions. A board action's `run`
// gets the board, its target and CoreApi alone, so it cannot see where the
// user opened a menu. The DAG's class and its UI are one package's code,
// which share what the UI notes here
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2, notes):
//
// - The point where the user pastes, on the canvas. Before the UI calls
//   menu(), it notes where the menu opens. Before it calls trigger() from its
//   toolbar or a key, it notes the middle of its view. Paste's run reads the
//   point that the UI noted last.
// - How each canvas that is mounted fits its view to the board. Layout's
//   quick action fits the view once it has laid the board out again, as the
//   canvas fits the view as it first mounts on a board. The canvas cannot
//   tell a step of relayout of blockr.graph from another step by itself,
//   since a step does not say which command made it.

import type { Point } from "../state/index.ts";

let noted: Point | undefined;

const fits = new Set<() => void>();

export function notePoint(point: Point): void {
  noted = point;
}

// The point that the UI noted last, or undefined where it has noted none, as
// where another plugin triggers Paste.
export function notedPoint(): Point | undefined {
  return noted;
}

// Has the canvas fit its view to the board as Layout lays the board out
// again, until the function that it returns runs.
export function onFit(fit: () => void): () => void {
  fits.add(fit);
  return () => {
    fits.delete(fit);
  };
}

// Fits the view of each canvas that is mounted to the board.
export function fitViews(): void {
  for (const fit of fits) fit();
}
