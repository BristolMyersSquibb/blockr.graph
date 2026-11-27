// Making room around what the DAG places, around a stack that collapses or
// expands, and around a stack whose shape a step grew or formed, through one
// projection that VPSC solves exactly along each axis.

export { closePairs } from "./pairs.ts";
export { project } from "./project.ts";
export type { Body, Push } from "./project.ts";
export { clearBox, clearStacks, closeUp, makeRoom } from "./room.ts";
export type { Added } from "./room.ts";
