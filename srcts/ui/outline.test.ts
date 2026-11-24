// What the panel of search and the outline lists
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#search-and-the-outline).

import { describe, expect, test } from "vitest";
import { boardOf } from "../testing/index.ts";
import { matching, outlineOf } from "./outline.ts";

// The stack s1 holds c, b and a, which link a to b to c, and the stack s2
// holds no block. The blocks e and d are in no stack, and d feeds e.
const board = (() => {
  const made = boardOf({
    blocks: { a: "Iris", b: "Head", c: "Filter", d: "Penguins", e: "Plot" },
    links: [
      ["a", "b"],
      ["b", "c"],
      ["d", "e"],
    ],
    stacks: { s1: ["c", "b", "a"] },
  });
  return { ...made, stacks: { ...made.stacks, s2: { name: "Spare", blocks: [], color: null } } };
})();

describe("the outline", () => {
  test("lists each stack with its blocks in the order of their links, then the blocks in no stack", () => {
    const outline = outlineOf(board);
    expect(outline.stacks.map(({ stack, name, blocks }) => [stack, name, blocks.map(({ block }) => block)])).toEqual([
      ["s1", "s1", ["a", "b", "c"]],
      ["s2", "Spare", []],
    ]);
    expect(outline.loose.map(({ block, name, stack }) => [block, name, stack])).toEqual([
      ["d", "Penguins", null],
      ["e", "Plot", null],
    ]);
  });

});

describe("a query", () => {
  test("matches the stacks and the blocks whose name or id holds it, ignoring case, the stacks first", () => {
    const found = matching(outlineOf(board), "  sPA ");
    expect(found.stacks.map(({ stack }) => stack)).toEqual(["s2"]);
    expect(found.blocks).toEqual([]);
    const byId = matching(outlineOf(board), "e");
    // Iris holds no "e", while the id of the block Plot is "e".
    expect(byId.blocks.map(({ block }) => block)).toEqual(["b", "c", "d", "e"]);
    expect(matching(outlineOf(board), "s1").stacks.map(({ stack }) => stack)).toEqual(["s1"]);
  });
});
