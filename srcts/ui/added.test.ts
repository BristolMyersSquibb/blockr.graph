// Where the DAG starts what a board action adds, through the `extend` of
// core's menu() and trigger()
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).

import type { Delta } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { boardOf, withState } from "../testing/index.ts";
import { startAt } from "./added.ts";

const point = { x: 40, y: 60 };

// The entry of a record by its key, which the test's board holds.
function held<T>(record: Readonly<Record<string, T>>, key: string): T {
  const value = record[key];
  if (value === undefined) throw new Error(`The board holds no "${key}".`);
  return value;
}

describe("what a board action adds", () => {
  test("starts at the point, a block", () => {
    const after = boardOf({ blocks: { a: "A", n: "New" }, links: [["a", "n"]] });
    const deltas: Delta[] = [{ blocks: { add: { n: held(after.blocks, "n") } } }, { links: { add: { l1: held(after.links, "l1") } } }];
    expect(startAt(after, deltas, point)).toEqual([{ id: "blockr.graph-change_position", args: { positions: { n: point } } }]);
  });

  test("starts at the point with the first of several blocks, in the order of their links", () => {
    const after = boardOf({ blocks: { b: "Second", c: "First" }, links: [["c", "b"]] });
    const deltas: Delta[] = [{ blocks: { add: { b: held(after.blocks, "b"), c: held(after.blocks, "c") } } }];
    expect(startAt(after, deltas, point)).toEqual([{ id: "blockr.graph-change_position", args: { positions: { c: point } } }]);
  });

  test("starts at the point, a stack that holds no block, but not one with blocks", () => {
    const after = boardOf({ blocks: { a: "A" }, stacks: { s: [], t: ["a"] } });
    expect(startAt(after, [{ stacks: { add: { s: held(after.stacks, "s") } } }], point)).toEqual([
      { id: "blockr.graph-change_position", args: { stacks: { s: point } } },
    ]);
    expect(startAt(after, [{ stacks: { add: { t: held(after.stacks, "t") } } }], point)).toEqual([]);
  });

  test("keeps the place that the batch gives what it adds, as Paste's", () => {
    const after = withState(boardOf({ blocks: { n: "New" } }), { positions: { n: { x: 500, y: 500 } } });
    expect(startAt(after, [{ blocks: { add: { n: held(after.blocks, "n") } } }], point)).toEqual([]);
  });

  test("adds nothing where the batch adds nothing", () => {
    expect(startAt(boardOf({ blocks: { a: "A" } }), [{ blocks: { mod: { a: { name: "Renamed" } } } }], point)).toEqual([]);
  });
});
