// The types of the DAG plugin's state, which the board holds at
// /plugins/blockr.graph-graph_plugin
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-state).
// The build generates the JSON Schema of the state from GraphState and writes
// it beside the DAG's module, as inst/js/graph.schema.json.
// The store checks the state against that schema after every change, and R
// reads the same file to write a board.
// The comment on each type and property becomes its description in the
// schema, which the assistant's model reads in place of code of its own for
// the DAG.
// Each is a `type` rather than an `interface`, so that a state is a Json.

/* eslint-disable @typescript-eslint/consistent-type-definitions -- an interface would not be assignable to Json */

import type { BlockId, StackId } from "@blockr/core";

/** The state of the Workflow, which draws the board as a directed acyclic graph of its blocks and the links between them: where each block sits on the canvas, what the DAG keeps about stacks, and how it arranges the board. */
export type GraphState = {
  /** Where each block sits on the canvas, by the block's id: the centre of the block's node, which holds its mark and its name below it. The canvas is no panel or view of the frontend. Set only the blocks to move: every other block keeps its position. Laying the board out again moves every block, so run blockr.graph-relayout before placing blocks by hand. */
  readonly positions: Readonly<Record<BlockId, Point>>;
  /** What the DAG keeps about a stack, by the stack's id, for a stack that holds no block, or one with blocks that the DAG shows collapsed. A stack that holds blocks and shows expanded has no entry. */
  readonly stacks: Readonly<Record<StackId, StackEntry>>;
  /** How the DAG arranges the board. */
  readonly layout: Layout;
};

/** A point on the canvas, in pixels, with x to the right and y downwards. A block is about 50 px across, so a block beside another sits about 150 px from it: to its left or right at the same y, or above or below it at the same x. */
export type Point = {
  /** How far to the right the point lies. */
  readonly x: number;
  /** How far down the point lies. */
  readonly y: number;
};

/** What the DAG keeps about a stack: the position of a stack that holds no block, or the collapse of a stack with blocks. */
export type StackEntry = Point | Collapse;

/** A stack with blocks that the DAG shows collapsed, as a small box centred where its blocks sit. */
export type Collapse = {
  /** The stack's place among the collapses, in the order they were made. */
  readonly collapsed: number;
  /** What collapsing the stack moved to close up on it, which expanding it puts back. */
  readonly moved: Moved;
};

/** What a collapse moved, by id, each from where and to where. */
export type Moved = {
  /** The blocks that the collapse moved, by the block's id. */
  readonly positions: Readonly<Record<BlockId, Move>>;
  /** The stacks that hold no block and that the collapse moved, by the stack's id. */
  readonly stacks: Readonly<Record<StackId, Move>>;
};

/** A move, from one point to another. */
export type Move = {
  /** Where the block or stack sat before the move. */
  readonly from: Point;
  /** Where the move put it. */
  readonly to: Point;
};

/** How the DAG arranges the board. Changing the direction or the spacing through blockr.graph-relayout lays the whole board out again. */
export type Layout = {
  /** The way that the board runs: TB from top to bottom, or LR from left to right. */
  readonly direction: "TB" | "LR";
  /** The gaps between blocks and between ranks: 50 px when compact, 70 px when normal and 100 px when loose. */
  readonly spacing: "compact" | "normal" | "loose";
  /** How a block that a step adds gets its place: repulsion keeps it where it starts and moves the blocks around it to make room, and beside moves it to the nearest free spot and moves no other block. */
  readonly placement: "repulsion" | "beside";
  /** Whether every position that the DAG sets snaps to a multiple of snap_size. */
  readonly snap: boolean;
  /**
   * The size that positions snap to, in pixels of the canvas.
   * @exclusiveMinimum 0
   */
  readonly snap_size: number;
};
