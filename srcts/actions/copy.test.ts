// What the DAG's Copy and Cut take of their target, and the JSON board that
// Copy writes (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions).

import type { JsonBoard, Target } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { GRAPH } from "../state/index.ts";
import type { GraphState } from "../state/index.ts";
import { boardOf, stateOf } from "../testing/index.ts";
import { copiedBoard, copiedOf, copies } from "./copy.ts";

// The blocks a to e, with a feeding b, b feeding c and d feeding e, the stack
// s1 of a and b, the stack s2 of d alone, and the stack s3, which holds no
// block.
const board = boardOf({
  blocks: { a: "A", b: "B", c: "C", d: "D", e: "E" },
  links: [
    ["a", "b"],
    ["b", "c"],
    ["d", "e"],
  ],
  stacks: { s1: ["a", "b"], s2: ["d"], s3: [] },
  state: {
    positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 150 }, c: { x: 0, y: 300 }, d: { x: 200, y: 0 }, e: { x: 200, y: 150 } },
    stacks: { s2: { collapsed: 1, moved: { positions: {}, stacks: {} } }, s3: { x: 400, y: 0 } },
  },
});

describe("what Copy takes", () => {
  test("of a block, is the block, and any stack that holds it alone", () => {
    expect(copiedOf(board, { block: "c" })).toEqual({ blocks: ["c"], stacks: [] });
    expect(copiedOf(board, { block: "d" })).toEqual({ blocks: ["d"], stacks: ["s2"] });
  });

  test("of a stack, is the stack with its blocks, or the stack alone where it holds none", () => {
    expect(copiedOf(board, { stack: "s1" })).toEqual({ blocks: ["a", "b"], stacks: ["s1"] });
    expect(copiedOf(board, { stack: "s3" })).toEqual({ blocks: [], stacks: ["s3"] });
  });

  test("of a selection, is its blocks and stacks, with each other stack whose blocks are all copied", () => {
    expect(copiedOf(board, { selection: [{ block: "a" }, { block: "b" }, { link: "l1" }] })).toEqual({ blocks: ["a", "b"], stacks: ["s1"] });
    expect(copiedOf(board, { selection: [{ block: "c" }, { stack: "s3" }] })).toEqual({ blocks: ["c"], stacks: ["s3"] });
  });

  test("is nothing of a link, of the board, or of what the board does not hold", () => {
    for (const target of [{ link: "l1" }, { board: true as const }, { block: "gone" }, { selection: [{ link: "l2" }] }]) {
      expect(copies(board, target)).toBe(false);
    }
    expect(copies(board, { block: "a" })).toBe(true);
  });
});

describe("the JSON board that Copy writes", () => {
  // The store's JSON board of the board, where e is of a class of
  // blockr.ggplot, and a plugin of blockr.test holds state beside the DAG.
  const json: JsonBoard = {
    format: 1,
    packages: { "blockr.core": "0.2.0", "blockr.ggplot": "0.2.0", "blockr.graph": "0.2.0", "blockr.test": "0.1.0" },
    board: {
      ...board,
      blocks: Object.fromEntries(
        Object.entries(board.blocks).map(([id, block]) => [
          id,
          { ...block, registry_id: id === "e" ? "blockr.ggplot-ggplot_block" : block.registry_id, version: 1 },
        ]),
      ),
      options: { "blockr.core-board_name": { value: "Test", version: 1 } },
      plugins: { [GRAPH]: { state: stateOf(board), version: 1 }, "blockr.test-notes": { state: { text: "" }, version: 1 } },
    },
  };

  test("holds what Copy takes, the links between its blocks, and their positions", () => {
    const copied = copiedBoard(json, copiedOf(board, { selection: [{ stack: "s1" }, { block: "d" }, { stack: "s3" }] }));
    expect(Object.keys(copied.board.blocks)).toEqual(["a", "b", "d"]);
    expect(copied.board.blocks.a).toEqual(json.board.blocks.a);
    expect(Object.keys(copied.board.links)).toEqual(["l1"]);
    expect(Object.keys(copied.board.stacks)).toEqual(["s1", "s2", "s3"]);
    const state = copied.board.plugins[GRAPH]?.state as GraphState;
    expect(state.positions).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 150 }, d: { x: 200, y: 0 } });
    // A collapsed stack pastes expanded, and a stack that holds no block keeps
    // its position.
    expect(state.stacks).toEqual({ s3: { x: 400, y: 0 } });
    expect(state.layout).toEqual(stateOf(board).layout);
  });

  test("records the format, and holds no other plugin's state and no board option", () => {
    const copied = copiedBoard(json, copiedOf(board, { block: "c" }));
    expect(copied.format).toBe(1);
    expect(Object.keys(copied.board.plugins)).toEqual([GRAPH]);
    expect(copied.board.options).toEqual({});
  });

  test("lists only the packages that the copied blocks' classes and the DAG plugin's class come from", () => {
    const packages = (target: Target, from: JsonBoard = json) => copiedBoard(from, copiedOf(board, target)).packages;
    expect(packages({ block: "c" })).toEqual({ "blockr.core": "0.2.0", "blockr.graph": "0.2.0" });
    expect(packages({ selection: [{ block: "c" }, { block: "e" }] })).toEqual({
      "blockr.core": "0.2.0",
      "blockr.ggplot": "0.2.0",
      "blockr.graph": "0.2.0",
    });
    expect(packages({ stack: "s3" })).toEqual({ "blockr.graph": "0.2.0" });
    // Where the board holds no state of the DAG, the copied board holds none
    // either, and does not list blockr.graph.
    expect(packages({ block: "c" }, { ...json, board: { ...json.board, plugins: {} } })).toEqual({ "blockr.core": "0.2.0" });
  });
});
