// Whether the DAG's element holds its panel of advanced actions below the
// canvas, and how far the canvas pans so that the object that the advanced
// action is about stays in view above the panel
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#its-advanced-actions).
// Every box here is on the screen, relative to the DAG's element, whose top
// the canvas's top is.
//
// The panel docks at the bottom of the element, as wide as the element, and
// takes at most half of its height (../modules/graph/index.css). The canvas
// shrinks to what the panel leaves above it, so that the panel hides nothing
// of the canvas. Where the object then lies below the canvas's bottom, or
// above its top, the canvas pans it into view.
//
// Where the element is narrower than every place of an advanced action is
// wide, as a narrow panel of the dock is, or too low to hold the canvas above
// the panel, the DAG hands core no `advanced`, so that the frontend shows the
// advanced action in its own place.

// The width that every place of an advanced action has at least
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.16#the-advanced-action).
export const PANEL_WIDTH = 420;

// The least height of the element, of which the panel takes at most half.
export const LEAST_HEIGHT = 400;

// The room that the object keeps from the canvas's top and bottom once the
// canvas has panned it into view, as the toolbar keeps from the element's
// edges.
const MARGIN = 10;

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// Whether the element holds the canvas with the panel below it.
export function hasRoom(frame: { readonly width: number; readonly height: number }): boolean {
  return frame.width >= PANEL_WIDTH && frame.height >= LEAST_HEIGHT;
}

// How far the canvas pans the object down, on the screen, so that it lies
// within the margins of a canvas of the height given, and with its top at
// the top margin where it is taller than the canvas holds.
export function revealPan(object: Rect, height: number): number {
  if (object.top < MARGIN || object.height > height - 2 * MARGIN) return MARGIN - object.top;
  const bottom = object.top + object.height;
  return bottom > height - MARGIN ? height - MARGIN - bottom : 0;
}
