// The class's `update`, `afterStep` and `start`, as functions of boards, on
// boards built for each case.

import type { Board, Delta } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { loadDagre } from "../layout/index.ts";
import { GRAPH, isPoint } from "../state/index.ts";
import type { Point } from "../state/index.ts";
import { boardOf, stateOf, withState } from "../testing/index.ts";
import { afterStep, starting, update } from "./index.ts";

const at = (x: number, y: number): Point => ({ x, y });
const path = (...segments: string[]) => `/plugins/${GRAPH}/${segments.join("/")}`;
const none = { positions: {}, stacks: {} };

// The board with the patches applied to the DAG's state, as the store would
// apply them, for patches at keys of objects.
function patched(board: Board, patches: readonly { op: string; path: string; value?: unknown }[]): Board {
  const state: Record<string, unknown> = structuredClone(stateOf(board));
  for (const patch of patches) {
    const segments = patch.path.split("/").slice(3);
    const last = segments.pop() ?? "";
    let into = state;
    for (const segment of segments) into = into[segment] as Record<string, unknown>;
    if (patch.op === "remove") Reflect.deleteProperty(into, last);
    else into[last] = patch.value;
  }
  return withState(board, state);
}

describe("the class's update", () => {
  const board = boardOf({
    blocks: { a: "A", b: "B", c: "C" },
    stacks: { s1: ["a"], s2: [], s3: ["c"] },
    state: {
      positions: { a: at(0, 0), b: at(100, 0), c: at(200, 0) },
      stacks: {
        s2: at(0, 300),
        s3: { collapsed: 1, moved: { positions: { b: { from: at(90, 0), to: at(100, 0) } }, stacks: { s2: { from: at(0, 290), to: at(0, 300) } } } },
      },
    },
  });

  test("drops the position of a block that a delta removes, and what each collapse moved of it", () => {
    expect(update({ blocks: { rm: ["b"] } }, board, GRAPH)).toEqual([
      { op: "remove", path: path("positions", "b") },
      { op: "remove", path: path("stacks", "s3", "moved", "positions", "b") },
    ]);
  });

  test("drops the entry of a stack that a delta removes, and what each collapse moved of it", () => {
    expect(update({ stacks: { rm: ["s2", "s3"] } }, board, GRAPH)).toEqual([
      { op: "remove", path: path("stacks", "s2") },
      { op: "remove", path: path("stacks", "s3") },
    ]);
  });

  test("keeps what the state holds of an id that the delta removes and adds again", () => {
    const delta: Delta = { blocks: { rm: ["b"], add: { b: { registry_id: "blockr.core-head_block", state: {}, name: "B", locked: null } } } };
    expect(update(delta, board, GRAPH)).toEqual([]);
  });

  test("reads the state as the delta's patches leave it, and finds nothing more to drop the second time", () => {
    const delta: Delta = { blocks: { rm: ["b"] }, patches: [{ op: "remove", path: path("positions", "b") }] };
    expect(update(delta, board, GRAPH)).toEqual([{ op: "remove", path: path("stacks", "s3", "moved", "positions", "b") }]);
    expect(update({ ...delta, patches: [...(delta.patches ?? []), ...update(delta, board, GRAPH)] }, board, GRAPH)).toEqual([]);
  });

  test("changes nothing for a delta that removes nothing, or where the state has another shape", () => {
    expect(update({ name: "Other" }, board, GRAPH)).toEqual([]);
    expect(update({ blocks: { rm: ["b"] } }, { ...board, plugins: { [GRAPH]: { positions: [] } } }, GRAPH)).toEqual([]);
  });
});

describe("the class's afterStep", () => {
  test("places a block that the step adds by its links, in the step", () => {
    const before = boardOf({ blocks: { a: "A" }, state: { positions: { a: at(0, 0) } } });
    const board = boardOf({ blocks: { a: "A", n: "N" }, links: [["a", "n"]], state: { positions: { a: at(0, 0) } } });
    expect(afterStep(board, before, GRAPH)).toEqual([{ op: "add", path: path("positions", "n"), value: at(0, 122) }]);
  });

  test("changes nothing where the step adds nothing, and leaves a block that had no position before alone", () => {
    const before = boardOf({ blocks: { a: "A", b: "B" }, state: { positions: { a: at(0, 0) } } });
    expect(afterStep(withState(before, { positions: { a: at(5, 0) } }), before, GRAPH)).toEqual([]);
  });

  test("drops what Repulsion moves from what each collapse moved", () => {
    const collapse = { collapsed: 1, moved: { positions: { b: { from: at(0, 100), to: at(0, 122) } }, stacks: {} } };
    const spec = { blocks: { a: "A", b: "B", x: "X", y: "Y" }, stacks: { s: ["x", "y"] } };
    const state = { positions: { a: at(0, 0), b: at(0, 122), x: at(900, 0), y: at(900, 122) }, stacks: { s: collapse } };
    const before = boardOf({ ...spec, state });
    const board = boardOf({ ...spec, blocks: { ...spec.blocks, n: "N" }, links: [["a", "n"]], state });
    const patches = afterStep(board, before, GRAPH);
    expect(patches).toContainEqual({ op: "add", path: path("positions", "n"), value: at(0, 122) });
    expect(patches.some((patch) => patch.path === path("positions", "b"))).toBe(true);
    expect(patches).toContainEqual({ op: "remove", path: path("stacks", "s", "moved", "positions", "b") });
  });

  test("gives a stack that the step leaves without blocks a position, where its box was, in place of its collapse", () => {
    const state = { positions: { a: at(0, 0), b: at(100, 0) }, stacks: { s: { collapsed: 1, moved: none } } };
    const before = boardOf({ blocks: { a: "A", b: "B" }, stacks: { s: ["a", "b"] }, state });
    const board = boardOf({ blocks: { a: "A", b: "B" }, stacks: { s: [] }, state });
    expect(afterStep(board, before, GRAPH)).toEqual([{ op: "replace", path: path("stacks", "s"), value: at(50, 0) }]);
  });

  test("drops the position of a stack that holds a block", () => {
    const before = boardOf({ blocks: { a: "A" }, stacks: { s: [] }, state: { positions: { a: at(0, 0) }, stacks: { s: at(300, 0) } } });
    const board = boardOf({ blocks: { a: "A" }, stacks: { s: ["a"] }, state: stateOf(before) });
    expect(afterStep(board, before, GRAPH)).toEqual([{ op: "remove", path: path("stacks", "s") }]);
  });

  test("places a stack without blocks that the step adds", () => {
    const before = boardOf({ blocks: { a: "A" }, state: { positions: { a: at(0, 0) } } });
    const board = boardOf({ blocks: { a: "A" }, stacks: { s: [] }, state: stateOf(before) });
    const [patch] = afterStep(board, before, GRAPH);
    expect(patch).toMatchObject({ op: "add", path: path("stacks", "s") });
  });

  test("leaves a board without the DAG's state alone", () => {
    const board = { ...boardOf({ blocks: { a: "A" } }), plugins: {} };
    expect(afterStep(board, board, GRAPH)).toEqual([]);
  });
});

describe("starting on a board", () => {
  test("waits for dagre where the board holds no position, and then lays the whole board out", async () => {
    const board = boardOf({ blocks: { a: "A", b: "B" }, links: [["a", "b"]], stacks: { empty: [] } });
    expect(starting(board, GRAPH)).toBe("layout");
    const step = starting(board, GRAPH, await loadDagre());
    if (step === "layout") throw new Error("no step");
    const after = patched(board, step.patches);
    expect(Object.keys(stateOf(after).positions)).toEqual(["a", "b"]);
    expect(Object.keys(stateOf(after).stacks)).toEqual(["empty"]);
    expect(step.dropped).toEqual([]);
  });

  test("places what lacks a position as Beside places it, and keeps every block that has one where it is", () => {
    const board = boardOf({ blocks: { a: "A", b: "B", n: "N" }, links: [["a", "n"]], state: { positions: { a: at(0, 0), b: at(0, 122) } } });
    const step = starting(board, GRAPH);
    if (step === "layout") throw new Error("no step");
    expect(step.patches).toHaveLength(1);
    expect(step.patches[0]).toMatchObject({ op: "add", path: path("positions", "n") });
    expect(stateOf(patched(board, step.patches)).positions.n).not.toEqual(at(0, 122));
  });

  test("drops what does not fit the board, and names each entry that it drops", () => {
    const board = boardOf({
      blocks: { a: "A", b: "B" },
      stacks: { s1: ["a"], s2: [], s3: ["b"] },
      state: {
        positions: { a: at(0, 0), b: at(200, 0), gone: at(0, 0) },
        stacks: {
          s1: at(5, 5),
          s2: { collapsed: 1, moved: none },
          s3: { collapsed: 2, moved: { positions: { gone: { from: at(0, 0), to: at(1, 1) } }, stacks: { lost: { from: at(0, 0), to: at(1, 1) } } } },
          s9: at(0, 0),
        },
      },
    });
    const step = starting(board, GRAPH);
    if (step === "layout") throw new Error("no step");
    expect(step.dropped).toEqual([
      'the position of the block "gone", which the board lacks',
      'the position of the stack "s1", which holds blocks',
      'the collapse of the stack "s2", which holds no block',
      'what the collapse of the stack "s3" moved of the block "gone", which the board lacks',
      'what the collapse of the stack "s3" moved of the stack "lost", which the board lacks',
      'the entry of the stack "s9", which the board lacks',
    ]);
    const state = stateOf(patched(board, step.patches));
    expect(Object.keys(state.positions)).toEqual(["a", "b"]);
    expect(Object.keys(state.stacks)).toEqual(["s2", "s3"]);
    expect(state.stacks.s2 !== undefined && isPoint(state.stacks.s2)).toBe(true);
    expect(state.stacks.s3).toEqual({ collapsed: 2, moved: none });
  });

  test("changes nothing on a board whose state fits it", () => {
    const board = boardOf({ blocks: { a: "A" }, state: { positions: { a: at(0, 0) } } });
    expect(starting(board, GRAPH)).toEqual({ patches: [], dropped: [] });
    expect(starting({ ...board, plugins: {} }, GRAPH)).toEqual({ patches: [], dropped: [] });
  });
});
