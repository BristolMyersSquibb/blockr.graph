// What the DAG's UI notes for the DAG's board actions. A board action's `run`
// gets the board, its target and CoreApi alone, so it cannot see where the
// user opened a menu. The DAG's class and its UI are one package's code,
// which share what the UI notes here
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2, notes):
//
// - Where the user pastes. Before the UI calls menu(), it notes the point on
//   the canvas where the menu opens. Before it calls trigger() from its
//   toolbar or a key, it notes the middle of its view. With the point, it
//   notes how to tell the user why Paste adds nothing, where they opened the
//   menu or triggered the board action, as it shows a refused batch there.
//   Paste's run reads what the UI noted last.
// - How each canvas that is mounted fits its view to the board. Layout's
//   quick action fits the view once it has laid the board out again, as the
//   canvas fits the view as it first mounts on a board. The canvas cannot
//   tell a step of blockr.graph-relayout from another step by itself, since a
//   step does not say which command made it.

import type { Point } from "../state/index.ts";

// Where the user pastes, as the UI notes it.
export interface NotedPaste {
  // The point on the canvas where the middle of what Paste adds lands.
  readonly point: Point;
  // Shows the message where the user opened the menu or triggered the board
  // action, as information, such as that the clipboard holds nothing to
  // paste.
  readonly inform: (message: string) => void;
  // Shows the message there as a refusal, as the DAG shows a refused batch.
  readonly refuse: (message: string) => void;
}

let noted: NotedPaste | undefined;

const fits = new Set<() => void>();

export function notePaste(paste: NotedPaste): void {
  noted = paste;
}

// What the UI noted last, or undefined where it has noted nothing, as where
// another plugin triggers Paste before the user has used the DAG.
export function notedPaste(): NotedPaste | undefined {
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
