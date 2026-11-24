// Where the DAG's panel of advanced actions goes, beside the object that its
// advanced action is about, and how far the canvas pans so that the object
// stays in view beside it
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#its-advanced-actions).
// Every box here is on the screen, relative to the DAG's element.
//
// 1. The panel goes to the right of the object where the element has room for
//    it there, and else to its left.
// 2. Where neither side has room, the panel goes to the element's right edge,
//    and the canvas pans the object to the left of it.
// 3. Where the object lies above or below the element's edges, the canvas
//    pans it into view as well.
// 4. The panel's top is level with the object's top, but low enough on the
//    element that the panel keeps a height of its own, and the panel reaches
//    at most to the element's bottom.
//
// Where the element is too narrow to hold the object and the panel side by
// side, as in a narrow panel of the dock, there is no place, and the DAG then
// hands core no `advanced`, so that the frontend shows the advanced action in
// its own place.

// The panel's width, which every place of an advanced action has at least
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.16#the-advanced-action).
export const PANEL_WIDTH = 420;

// The room between the panel and the object, and between either and the
// element's edges, as the toolbar keeps from the element's edges and from the
// panel of search beside it.
const GAP = 8;
const MARGIN = 10;

// The least height that the panel keeps where the object sits low.
const LEAST_HEIGHT = 240;

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PanelPlace {
  readonly left: number;
  readonly top: number;
  // The most that the panel grows to, down to the element's bottom.
  readonly height: number;
  // How far the canvas pans, on the screen, so that the object shows beside
  // the panel.
  readonly pan: { readonly x: number; readonly y: number };
}

// Where the panel goes beside the object in an element of the size given, or
// undefined where the element has no room for both side by side.
export function panelPlace(object: Rect, frame: { readonly width: number; readonly height: number }): PanelPlace | undefined {
  if (!hasRoom(object, frame)) return undefined;
  const right = object.left + object.width;
  let left: number;
  let x = 0;
  if (right + GAP + PANEL_WIDTH + MARGIN <= frame.width) {
    left = right + GAP;
  } else if (object.left - GAP - PANEL_WIDTH >= MARGIN) {
    left = object.left - GAP - PANEL_WIDTH;
  } else {
    left = frame.width - MARGIN - PANEL_WIDTH;
    x = left - GAP - right;
  }
  const y = panInto(object.top, object.height, frame.height);
  const top = Math.min(Math.max(object.top + y, MARGIN), Math.max(MARGIN, frame.height - MARGIN - LEAST_HEIGHT));
  return { left, top, height: Math.max(0, frame.height - MARGIN - top), pan: { x, y } };
}

// Whether the element holds the object and the panel side by side.
export function hasRoom(object: Pick<Rect, "width">, frame: { readonly width: number }): boolean {
  return MARGIN + object.width + GAP + PANEL_WIDTH + MARGIN <= frame.width;
}

// How far the canvas pans an object along one axis so that it lies within the
// element's margins, aligning a longer object with the element's start.
function panInto(start: number, size: number, length: number): number {
  if (start < MARGIN || size > length - 2 * MARGIN) return MARGIN - start;
  const end = start + size;
  return end > length - MARGIN ? length - MARGIN - end : 0;
}
