// What the tests share: boards built from a short description, the layered
// boards of the spike that checked making room, the state after a collapse
// or an expand, and the spike's criteria.

export { boardOf, folded, layeredBoard, lcg, SHAPES, stackSpecs, stateOf, withStacks, withState } from "./boards.ts";
export type { BoardSpec, StackSpec } from "./boards.ts";
export { furthest, intruders, newlyClose, reshaped, swapped } from "./criteria.ts";
