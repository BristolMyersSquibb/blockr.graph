// The DAG's state: the JSON Patch through which the DAG reads what a delta's
// patches leave of it, and the checks of its shape.

import { describe, expect, test } from "vitest";
import { defaultState, GRAPH, isGraphState, patched, pointer } from "./index.ts";

const at = (path: string) => `/plugins/${GRAPH.package}/${GRAPH.id}${path}`;

describe("the JSON Patch of the DAG's state", () => {
  test("writes a pointer to a key with a slash or a tilde in it", () => {
    expect(pointer(["plugins", GRAPH.package, GRAPH.id, "positions", "a/b~c"])).toBe("/plugins/blockr.graph/graph_plugin/positions/a~1b~0c");
  });

  test("applies the patches of the plugin in order, and skips those of others", () => {
    const state = patched(
      defaultState,
      [
        { op: "add", path: at("/positions/a~1b"), value: { x: 1, y: 2 } },
        { op: "replace", path: at("/positions/a~1b"), value: { x: 3, y: 4 } },
        // Another class of the DAG's package, and a class of the DAG's id in
        // another package.
        { op: "add", path: "/plugins/blockr.graph/other_plugin/positions/c", value: 1 },
        { op: "add", path: "/plugins/other/graph_plugin/positions/c", value: 1 },
        { op: "replace", path: at("/layout/snap"), value: true },
      ],
      GRAPH,
    );
    expect(state).toEqual({ ...defaultState, positions: { "a/b": { x: 3, y: 4 } }, layout: { ...defaultState.layout, snap: true } });
  });

  test("replaces the state whole for a patch at the plugin's own path", () => {
    expect(patched(defaultState, [{ op: "replace", path: at(""), value: 1 }], GRAPH)).toBe(1);
  });

  test.each([
    ["removes what the state lacks", { op: "remove", path: at("/positions/a") }],
    ["replaces what the state lacks", { op: "replace", path: at("/positions/a"), value: 1 }],
    ["leads into what the state lacks", { op: "add", path: at("/positions/a/x"), value: 1 }],
    ["adds without a value", { op: "add", path: at("/positions/a") }],
    ["leads into a number", { op: "add", path: at("/layout/snap_size/x"), value: 1 }],
    ["removes the state", { op: "remove", path: at("") }],
  ] as const)("cannot apply a patch that %s", (_, patch) => {
    expect(patched(defaultState, [patch], GRAPH)).toBeUndefined();
  });

  test("removes a key", () => {
    const state = { ...defaultState, positions: { a: { x: 1, y: 2 } } };
    expect(patched(state, [{ op: "remove", path: at("/positions/a") }], GRAPH)).toEqual(defaultState);
  });

  test("skips a path that is no pointer below the board's root", () => {
    expect(patched(defaultState, [{ op: "add", path: "plugins", value: 1 }, { op: "add", path: "/~2", value: 1 }], GRAPH)).toBe(defaultState);
  });
});

describe("the check of the state's shape", () => {
  test("takes the default, and a state with positions and entries of both kinds", () => {
    expect(isGraphState(defaultState)).toBe(true);
    const state = {
      ...defaultState,
      positions: { a: { x: 1, y: 2 } },
      stacks: { s1: { x: 0, y: 0 }, s2: { collapsed: 1, moved: { positions: { a: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } } }, stacks: {} } } },
    };
    expect(isGraphState(state)).toBe(true);
  });

  test.each([
    ["no object", 1],
    ["positions that are no object", { ...defaultState, positions: [] }],
    ["a position without y", { ...defaultState, positions: { a: { x: 1 } } }],
    ["a collapse without what it moved", { ...defaultState, stacks: { s: { collapsed: 1 } } }],
    ["a move without where it went", { ...defaultState, stacks: { s: { collapsed: 1, moved: { positions: { a: { from: { x: 0, y: 0 } } }, stacks: {} } } } }],
    ["a direction that the layout lacks", { ...defaultState, layout: { ...defaultState.layout, direction: "BT" } }],
  ])("refuses %s", (_, value) => {
    expect(isGraphState(value)).toBe(false);
  });
});
