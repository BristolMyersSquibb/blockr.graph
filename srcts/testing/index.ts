// What the tests share: boards built from a short description, the layered
// boards of the spike that checked making room, and its criteria.

export { boardOf, layeredBoard, lcg, SHAPES, stackSpecs, stateOf, withStacks, withState } from "./boards.ts";
export type { BoardSpec, StackSpec } from "./boards.ts";
export { furthest, intruders, newlyClose, swapped } from "./criteria.ts";
