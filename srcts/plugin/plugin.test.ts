// The class's `update`, `afterStep` and `start`, as functions of boards, on
// boards built for each case.

import type { Board, Delta } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { collapse, expand } from "../collapse/index.ts";
import { canvasOf, distance, gapOf, shownBox } from "../geometry/index.ts";
import { loadDagre } from "../layout/index.ts";
import { GRAPH, isPoint } from "../state/index.ts";
import type { Point } from "../state/index.ts";
import { boardOf, folded, intruders, reshaped, stateOf, withState } from "../testing/index.ts";
import type { BoardSpec } from "../testing/index.ts";
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
    const state = { positions: { a: at(0, 0), b: at(400, 0) }, stacks: { s: { collapsed: 1, moved: none } } };
    const before = boardOf({ blocks: { a: "A", b: "B" }, stacks: { s: ["a", "b"] }, state });
    const board = boardOf({ blocks: { a: "A", b: "B" }, stacks: { s: [] }, state });
    expect(afterStep(board, before, GRAPH)).toEqual([{ op: "replace", path: path("stacks", "s"), value: at(200, 0) }]);
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

describe("making room around the stacks that a step grows or forms", () => {
  const gap = gapOf("normal");

  // The board after the step, with the patches of afterStep applied.
  const stepped = (board: Board, before: Board) => patched(board, afterStep(board, before, GRAPH));
  const positions = (board: Board, blocks: readonly string[]) => blocks.map((block) => stateOf(board).positions[block]);

  // The example `stacks`: a chain of Dataset, Head and Rbind on the left, and
  // the stack Joins on the right.
  const example: BoardSpec = {
    blocks: { iris: "Dataset", head: "Head", bound: "Rbind", bod: "Dataset", cw: "Dataset", joined: "Merge" },
    links: [
      ["iris", "head"],
      ["head", "bound"],
      ["bod", "joined"],
      ["cw", "joined"],
    ],
    stacks: { joins: ["bod", "cw", "joined"] },
    state: { positions: { iris: at(0, 0), head: at(0, 150), bound: at(0, 300), bod: at(300, 0), cw: at(450, 0), joined: at(375, 150) } },
  };

  test("moves the blocks that a stack's box grows over off it, and leaves the stack where it is", () => {
    const before = boardOf(example);
    const board = boardOf({ ...example, stacks: { joins: ["bod", "cw", "joined", "bound"] } });
    expect(intruders(canvasOf(board, stateOf(board)))).toEqual([
      ["block:iris", "joins"],
      ["block:head", "joins"],
    ]);
    const after = stepped(board, before);
    expect(intruders(canvasOf(after, stateOf(after)), gap - 0.5)).toEqual([]);
    const joins = ["bod", "cw", "joined", "bound"];
    expect(positions(after, joins)).toEqual(positions(board, joins));
    expect(reshaped(canvasOf(before, stateOf(before)), canvasOf(after, stateOf(after)))).toEqual([]);
  });

  test("moves a stack that a stack's box grows towards off it, as one", () => {
    const spec: BoardSpec = {
      blocks: { a: "A", b: "B", c: "C", d: "D" },
      stacks: { s1: ["a", "b"], s2: ["c", "d"] },
      state: { positions: { a: at(0, 0), b: at(0, 122), c: at(300, 0), d: at(300, 122) } },
    };
    const before = boardOf(spec);
    const board = boardOf({ ...spec, state: { positions: { ...spec.state?.positions, b: at(200, 122) } } });
    const after = stepped(board, before);
    const canvas = canvasOf(after, stateOf(after));
    const [one, two] = [shownBox(canvas, "s1"), shownBox(canvas, "s2")];
    if (one === undefined || two === undefined) throw new Error("no box");
    expect(distance(one, two)).toBeGreaterThan(gap - 0.5);
    expect(positions(after, ["a", "b"])).toEqual([at(0, 0), at(200, 122)]);
    expect(reshaped(canvasOf(board, stateOf(board)), canvas)).toEqual([]);
    expect(stateOf(after).positions.c?.x).toBeGreaterThan(300);
  });

  test("moves what lies in the box of a stack that the step forms off it, and what lies within the gap of it", () => {
    const spec: BoardSpec = {
      blocks: { x: "X", y: "Y", z: "Z", w: "W" },
      state: { positions: { x: at(0, 0), z: at(150, 0), y: at(300, 0), w: at(150, 100) } },
    };
    const before = boardOf(spec);
    const board = boardOf({ ...spec, stacks: { s: ["x", "y"] } });
    const after = stepped(board, before);
    expect(intruders(canvasOf(after, stateOf(after)), gap - 0.5)).toEqual([]);
    expect(positions(after, ["x", "y"])).toEqual([at(0, 0), at(300, 0)]);
  });

  test("moves the blocks of a stack that the step leaves without blocks off its box", () => {
    const state = { positions: { a: at(0, 0), b: at(100, 0) }, stacks: { s: { collapsed: 1, moved: none } } };
    const before = boardOf({ blocks: { a: "A", b: "B" }, stacks: { s: ["a", "b"] }, state });
    const board = boardOf({ blocks: { a: "A", b: "B" }, stacks: { s: [] }, state });
    const after = stepped(board, before);
    expect(stateOf(after).stacks.s).toEqual(at(50, 0));
    const box = shownBox(canvasOf(after, stateOf(after)), "s");
    if (box === undefined) throw new Error("no box");
    for (const block of ["a", "b"]) {
      const point = stateOf(after).positions[block] ?? at(0, 0);
      expect(distance(box, { ...point, w: 32, h: 52 })).toBeGreaterThan(gap - 0.5);
    }
  });

  test("moves a stack aside as one, where Repulsion places a block that the step adds in its box", () => {
    const spec: BoardSpec = {
      blocks: { u: "U", w: "W" },
      stacks: { s: ["u", "w"] },
      state: { positions: { u: at(0, 0), w: at(0, 244) } },
    };
    const before = boardOf(spec);
    const board = boardOf({
      ...spec,
      blocks: { ...spec.blocks, n: "N" },
      links: [
        ["u", "n"],
        ["n", "w"],
      ],
    });
    const after = stepped(board, before);
    expect(stateOf(after).positions.n).toEqual(at(0, 122));
    expect(intruders(canvasOf(after, stateOf(after)), gap - 0.5)).toEqual([]);
    expect(reshaped(canvasOf(board, stateOf(board)), canvasOf(after, stateOf(after)))).toEqual([]);
  });

  test("changes nothing after a step that collapses or expands a stack, which makes room itself", () => {
    const spec: BoardSpec = {
      blocks: { a: "A", b: "B", c: "C", d: "D", e: "E" },
      stacks: { s: ["a", "b"], t: ["c", "d"] },
      state: { positions: { a: at(0, 0), b: at(0, 122), c: at(260, 0), d: at(260, 122), e: at(0, 300) } },
    };
    const board = boardOf(spec);
    const closed = withState(board, folded(stateOf(board), collapse(board, stateOf(board), "s")));
    expect(afterStep(closed, board, GRAPH)).toEqual([]);
    const open = withState(closed, folded(stateOf(closed), expand(closed, stateOf(closed), "s")));
    expect(afterStep(open, closed, GRAPH)).toEqual([]);
  });

  test("changes nothing after a step that leaves every stack's box as it was", () => {
    const before = boardOf(example);
    const board = boardOf({ ...example, state: { positions: { ...example.state?.positions, iris: at(-50, 0) } } });
    expect(afterStep(board, before, GRAPH)).toEqual([]);
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
