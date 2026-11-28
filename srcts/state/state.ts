// The default of the DAG plugin's state
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-state),
// where the board holds it, and checks of a value's shape.

import type { Board, Json, PluginClassId } from "@blockr/core";
import { isObject } from "./json.ts";
import type { Collapse, GraphState, Layout, Move, Moved, Point, StackEntry } from "./types.ts";

// The id of the DAG plugin's class. The board holds the DAG's state under its
// package and its id, at /plugins/blockr.graph/graph_plugin.
// It is the plain record that JSON holds, rather than core's Id, since only
// core.id() gives an Id, and the DAG's commands get no CoreApi.
// The functions of the DAG that take a plugin take this shape, which core's
// Id fits as well. Where the id goes to a function of core's, the DAG passes
// core.id(GRAPH.package, GRAPH.id).
export const GRAPH: Pick<PluginClassId, "package" | "id"> = { package: "blockr.graph", id: "graph_plugin" };

// The state that the store gives a board that holds none for the DAG.
// It holds no position, so the DAG lays the whole board out as the board
// opens.
// Its layout is the one that R's graph_layout() gives by default, as the
// default of R's new_graph_plugin() holds it.
export const defaultState: GraphState = {
  positions: {},
  stacks: {},
  layout: { direction: "TB", spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 },
};

// The DAG's state on the board, under the package and the id of the plugin's
// class, or undefined where the board holds none of its shape, as where the
// app does not run the DAG.
export function graphState(board: Board, plugin: Pick<PluginClassId, "package" | "id"> = GRAPH): GraphState | undefined {
  const state = board.plugins[plugin.package]?.[plugin.id];
  return isGraphState(state) ? state : undefined;
}

// Whether a value has the shape of the DAG's state, as far as code reads it.
// Unlike the schema, it lets a snap size be 0 or less, and it ignores
// properties that the types do not declare.
export function isGraphState(value: Json | undefined): value is GraphState {
  return (
    isObject(value) &&
    isRecordOf(value.positions, isPoint) &&
    isRecordOf(value.stacks, isStackEntry) &&
    isLayout(value.layout)
  );
}

// Whether an entry in `stacks` is the collapse of a stack with blocks, rather
// than the position of a stack that holds no block.
export function isCollapse(entry: StackEntry): entry is Collapse {
  return "collapsed" in entry;
}

export function isPoint(value: Json | undefined): value is Point {
  return isObject(value) && typeof value.x === "number" && typeof value.y === "number";
}

function isStackEntry(value: Json | undefined): value is StackEntry {
  if (!isObject(value)) return false;
  if (!("collapsed" in value)) return isPoint(value);
  return typeof value.collapsed === "number" && isMoved(value.moved);
}

function isMoved(value: Json | undefined): value is Moved {
  return isObject(value) && isRecordOf(value.positions, isMove) && isRecordOf(value.stacks, isMove);
}

function isMove(value: Json | undefined): value is Move {
  return isObject(value) && isPoint(value.from) && isPoint(value.to);
}

function isLayout(value: Json | undefined): value is Layout {
  return (
    isObject(value) &&
    (value.direction === "TB" || value.direction === "LR") &&
    (value.spacing === "compact" || value.spacing === "normal" || value.spacing === "loose") &&
    (value.placement === "repulsion" || value.placement === "beside") &&
    typeof value.snap === "boolean" &&
    typeof value.snap_size === "number"
  );
}

function isRecordOf(value: Json | undefined, item: (value: Json) => boolean): boolean {
  return isObject(value) && Object.values(value).every(item);
}
