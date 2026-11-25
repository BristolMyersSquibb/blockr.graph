// Placing whatever a step adds: where it starts, by the links of the board
// that the step leaves, and how the placement strategy fits it in, and the
// free spot near a point at which a paste or an add lands.

export { beside } from "./beside.ts";
export { freeOffset, shownBoxes } from "./free.ts";
export { placeAdded } from "./place.ts";
export { linkOrder, startPoints } from "./start.ts";
export { wayOf } from "./ways.ts";
export type { Axis, Way } from "./ways.ts";
