// The DAG plugin's state: its types, from which the build generates the
// state's JSON Schema, its default, checks of its shape, and the JSON Patch
// through which every part of the DAG reads and writes it.

export { isObject } from "./json.ts";
export { patched, pointer } from "./patch.ts";
export { defaultState, GRAPH, graphState, isCollapse, isGraphState, isPoint } from "./state.ts";
export type { Collapse, GraphState, Layout, Move, Moved, Point, StackEntry } from "./types.ts";
