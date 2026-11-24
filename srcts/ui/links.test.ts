// What a link that the user drops on a handle does
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures).

import type { BlockRegistry, Board, RegistryEntry } from "@blockr/core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { canvasOf } from "../geometry/index.ts";
import { defaultState, GRAPH } from "../state/index.ts";
import type { GraphState } from "../state/index.ts";
import { elementsOf, NEXT } from "./elements.ts";
import type { HandleSpec } from "./elements.ts";
import { canvasDrop, linkDrop } from "./links.ts";
import { handleTarget } from "./nodes.tsx";

function entry(id: string, inputs: readonly string[]): RegistryEntry {
  return { id, name: id, description: "", keywords: [], category: "", icon: "", inputs, module: "", version: 1, schema: {}, block_name: id, state: {}, requests: {} };
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

describe("a link dropped on the canvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const at = new MouseEvent("mouseup", { clientX: 30, clientY: 40 });

  test("from a block's result appends a block, through its role", () => {
    expect(canvasDrop(at, nodes, "b:a", { id: "out", type: "source" })).toEqual({
      role: "append_block_role",
      target: { block: "a" },
      client: { x: 30, y: 40 },
    });
  });

  test("from an input prepends a block on it, or on a variadic block's next place", () => {
    expect(canvasDrop(at, nodes, "b:m", { id: "in:y", type: "target" })).toMatchObject({ role: "prepend_block_role", target: { block: "m", input: "y" } });
    expect(canvasDrop(at, nodes, "b:e", { id: NEXT, type: "target" })).toMatchObject({ role: "prepend_block_role", target: { block: "e", input: "" } });
  });

  test("adds nothing from a variadic block's place that a link holds, nor on a node", () => {
    expect(canvasDrop(at, nodes, "b:e", { id: "in:#ae", type: "target" })).toBeUndefined();
    const node = document.createElement("div");
    node.className = "react-flow__node";
    vi.spyOn(document, "elementFromPoint").mockReturnValue(node);
    expect(canvasDrop(at, nodes, "b:a", { id: "out", type: "source" })).toBeUndefined();
  });
});

describe("a right click on a handle", () => {
  // The handle of the block's node that passes the check.
  const handle = (block: string, check: (spec: HandleSpec) => boolean): HandleSpec => {
    const node = nodes.find((each) => each.id === `b:${block}`);
    const found = node?.data.kind === "block" ? node.data.handles.find(check) : undefined;
    if (found === undefined) throw new Error(`No such handle of block ${block}`);
    return found;
  };

  test("opens the menu of the link that feeds its input, or of the input where none does", () => {
    expect(handleTarget("m", handle("m", (each) => each.id === "in:x#am"))).toEqual({ link: "am" });
    expect(handleTarget("m", handle("m", (each) => each.id === "in:y"))).toEqual({ block: "m", input: "y" });
    expect(handleTarget("e", handle("e", (each) => each.id === NEXT))).toEqual({ block: "e", input: "" });
  });

  test("on a block's result opens the block's menu, as the node does", () => {
    expect(handleTarget("a", handle("a", (each) => each.type === "source"))).toBeUndefined();
  });
});
