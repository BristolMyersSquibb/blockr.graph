// What a link that the user drops on a handle does
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures).

import type { BlockRegistry, Board, RegistryEntry } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { canvasOf } from "../geometry/index.ts";
import { defaultState, GRAPH } from "../state/index.ts";
import type { GraphState } from "../state/index.ts";
import { elementsOf, NEXT } from "./elements.ts";
import { linkDrop } from "./links.ts";

function entry(id: string, inputs: readonly string[]): RegistryEntry {
  return { id, name: id, description: "", keywords: [], category: "", icon: "", inputs, module: "", version: 1, schema: {}, state: {}, requests: {} };
}

const REGISTRY: BlockRegistry = {
  "test-data": entry("test-data", []),
  "test-merge": entry("test-merge", ["x", "y"]),
  "test-bind": entry("test-bind", ["..."]),
};

// The blocks a and b, which read nothing, m, which merges x and y, and e, a
// variadic block, which a feeds already.
const board: Board = {
  id: "test",
  name: "Test",
  blocks: {
    a: { registry_id: "test-data", state: {}, name: "A", locked: null },
    b: { registry_id: "test-data", state: {}, name: "B", locked: null },
    m: { registry_id: "test-merge", state: {}, name: "M", locked: null },
    e: { registry_id: "test-bind", state: {}, name: "E", locked: null },
  },
  links: { ae: { from: "a", to: "e", input: "" }, am: { from: "a", to: "m", input: "x" } },
  stacks: {},
  options: {},
  plugins: { [GRAPH]: { ...defaultState, positions: { a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, m: { x: 0, y: 150 }, e: { x: 200, y: 150 } } } },
};

const { nodes } = elementsOf({
  canvas: canvasOf(board, board.plugins[GRAPH] as GraphState),
  registry: REGISTRY,
  layout: defaultState.layout,
  selected: new Set(),
  hovered: null,
  locked: false,
  spread: null,
});

describe("a link dropped on a handle", () => {
  test("adds a link into the input of the handle, which the command checks", () => {
    expect(linkDrop(nodes, { source: "b:b", target: "b:m", targetHandle: "in:y" })).toEqual({ add: { from: "b", to: "m", input: "y" } });
    // Another link feeds x, which the command's preflight refuses.
    expect(linkDrop(nodes, { source: "b:b", target: "b:m", targetHandle: "in:x#am" })).toEqual({ add: { from: "b", to: "m", input: "x" } });
  });

  test("on a variadic block's placeholder takes the block's next place", () => {
    expect(linkDrop(nodes, { source: "b:b", target: "b:e", targetHandle: NEXT })).toEqual({ add: { from: "b", to: "e" } });
  });

  test("on a variadic block's place that a link holds adds nothing, and says that the place is taken", () => {
    expect(linkDrop(nodes, { source: "b:b", target: "b:e", targetHandle: "in:#ae" })).toEqual({
      taken: 'The link "ae" feeds the place "Input 1" of block "e" already.',
    });
  });

  test("between other nodes than two blocks, or on no handle of the node, adds nothing", () => {
    expect(linkDrop(nodes, { source: "s:s1", target: "b:m", targetHandle: "in:y" })).toBeUndefined();
    expect(linkDrop(nodes, { source: "b:b", target: "b:m", targetHandle: "in:z" })).toBeUndefined();
    expect(linkDrop(nodes, { source: "b:b", target: "b:gone", targetHandle: "in:y" })).toBeUndefined();
  });
});
