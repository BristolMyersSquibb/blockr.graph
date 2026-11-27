// The DAG plugin's class on blockr.core's CoreApi for tests, which opens a
// board as the page of an app that runs the DAG would, with R played from the
// fixtures of core's wire protocol, so that the tests need neither R nor a
// browser (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.12#testing).
// The store checks the DAG's state against the schema that the class gives,
// the file that the build writes for R, and runs the class's update,
// afterStep and start, and its commands, as on the page.
//
// The board of the fixture holds the blocks a to f, with the links ab, ac,
// bc, ad, be, de and keen_finch, from a to f, and the stack s1, which holds
// a and b.

import type { CoreApi, Json, JsonBoard } from "@blockr/core";
import { HELLO, stubCore } from "@blockr/core/stubs";
import type { StubCore } from "@blockr/core/stubs";
import { expectedWarnings } from "@blockr/ui/stubs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultState, GRAPH, isCollapse } from "../../state/index.ts";
import type { Collapse, GraphState, Point } from "../../state/index.ts";
import * as graph from "./index.ts";

// R's reply to hello in an app that runs the DAG beside core's plugins.
// The entry of the DAG plugin's class gives its name, the version of its
// state, 1, and where R serves its module.
const hello = {
  ...HELLO,
  packages: { ...HELLO.packages, "blockr.graph": "0.2.0" },
  plugins: [
    ...HELLO.plugins,
    { package: "blockr.graph", id: "graph_plugin", name: "Workflow", version: 1, options: [], module: "blockr.graph/js/graph.js" },
  ],
};

const BLOCKS = ["a", "b", "c", "d", "e", "f"];

// The state of the page that defines it
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-state),
// on the board of the fixture, whose stack s1 holds the blocks a and b.
// The stack s2 holds no block, so it has a position.
const state: GraphState = {
  positions: { a: { x: 120, y: 80 }, b: { x: 120, y: 200 } },
  stacks: {
    s1: {
      collapsed: 1,
      moved: { positions: { c: { from: { x: 120, y: 240 }, to: { x: 120, y: 200 } } }, stacks: {} },
    },
    s2: { x: 360, y: 80 },
  },
  layout: { direction: "TB", spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 },
};

// The board of the fixture, with a stack that holds no block and the DAG's
// state given, under the package and the id of the DAG plugin's class.
function boardWith(state: Json): JsonBoard {
  const { board } = HELLO.board;
  return {
    ...HELLO.board,
    packages: { ...HELLO.board.packages, "blockr.graph": "0.2.0" },
    board: {
      ...board,
      stacks: { ...board.stacks, s2: { name: "Empty", blocks: [], color: null } },
      plugins: { [GRAPH.package]: { [GRAPH.id]: { state, version: 1 } } },
    },
  };
}

// The board of the fixture with every block at a position: a row of blocks
// 150 px apart, which the class's start keeps.
const ROW = Object.fromEntries(BLOCKS.map((block, i) => [block, { x: 150 * i, y: 0 }]));
const placed = boardWith({ ...defaultState, positions: ROW });

let stub: StubCore | undefined;

async function start(board?: JsonBoard, lock = HELLO.lock): Promise<StubCore> {
  const reply = { ...hello, lock, ...(board === undefined ? {} : { board }) };
  stub = await stubCore({ hello: reply, offered: { [GRAPH.package]: { [GRAPH.id]: graph } } });
  return stub;
}

afterEach(() => {
  stub?.stop();
  stub = undefined;
});

// The DAG's state on the board that is open.
function dag(core: CoreApi): GraphState {
  return core.store.board().plugins[GRAPH.package]?.[GRAPH.id] as GraphState;
}

// Resolves once the class's start has given every block of the board a
// position, which it does once dagre has loaded where the board holds none.
async function positioned(core: CoreApi): Promise<GraphState> {
  await vi.waitFor(() => {
    expect(Object.keys(dag(core).positions).sort()).toEqual(Object.keys(core.store.board().blocks).sort());
  });
  return dag(core);
}

describe("the DAG plugin's class", () => {
  test("exports the JS API major that it was built against", () => {
    expect(graph.api).toBe(1);
  });

  test("gives a board that holds no state for the DAG the default state, which start lays out", async () => {
    const { core } = await start();
    const laid = await positioned(core);
    expect(laid.layout).toEqual(defaultState.layout);
    expect(laid.stacks).toEqual({});
    expect(core.store.canUndo()).toBe(false);
  });

  test("keeps the state that a board holds for the DAG, and places the blocks that lack a position", async () => {
    const { core } = await start(boardWith(state));
    const kept = await positioned(core);
    expect(kept.positions.a).toEqual(state.positions.a);
    expect(kept.positions.b).toEqual(state.positions.b);
    expect(kept.stacks).toEqual(state.stacks);
    expect(core.store.canUndo()).toBe(false);
  });

  test("lets the state change as its schema allows", async () => {
    const { core } = await start(placed);
    const patches: Json = [
      { op: "replace", path: "/positions/a", value: { x: 40, y: 80 } },
      { op: "add", path: "/stacks/s1", value: { collapsed: 1, moved: { positions: {}, stacks: {} } } },
      { op: "replace", path: "/layout/snap_size", value: 10 },
    ];
    await core.commands.run(core.id("blockr.core", "set_plugin_state"), { plugin: GRAPH, patches });
    expect(dag(core)).toEqual({
      positions: { ...ROW, a: { x: 40, y: 80 } },
      stacks: { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } }, s2: dag(core).stacks.s2 },
      layout: { ...defaultState.layout, snap_size: 10 },
    });
  });

  test.each([
    ["a position without y", { op: "add", path: "/positions/a", value: { x: 40 } }],
    ["a position whose x is no number", { op: "add", path: "/positions/a", value: { x: "left", y: 0 } }],
    [
      "a stack that both has a position and is collapsed",
      { op: "add", path: "/stacks/s1", value: { x: 0, y: 0, collapsed: 1, moved: { positions: {}, stacks: {} } } },
    ],
    ["a collapse without what it moved", { op: "add", path: "/stacks/s1", value: { collapsed: 1 } }],
    ["a direction that the layout lacks", { op: "replace", path: "/layout/direction", value: "BT" }],
    ["a snap size of 0", { op: "replace", path: "/layout/snap_size", value: 0 }],
    ["a part that the state lacks", { op: "add", path: "/zoom", value: 1 }],
  ])("refuses %s", async (_, patch) => {
    const { core } = await start(placed);
    const before = dag(core);
    const run = core.commands.run(core.id("blockr.core", "set_plugin_state"), { plugin: GRAPH, patches: [patch] });
    await expect(run).rejects.toThrow('The state of the plugin "graph_plugin of blockr.graph"');
    expect(dag(core)).toBe(before);
  });
});

describe("starting on a board", () => {
  test("drops what the state holds that does not fit the board, with a warning and a line of the log", async () => {
    // Core's stub prints the line of the log through console.warn, which the
    // test takes off the console.
    const warned = expectedWarnings(/The DAG dropped what its state held/);
    const stale = { ...defaultState, positions: { ...ROW, gone: { x: 0, y: 0 } }, stacks: { s9: { x: 0, y: 0 } } };
    const { core } = await start(boardWith(stale));
    expect(dag(core).positions.gone).toBeUndefined();
    expect(dag(core).stacks.s9).toBeUndefined();
    const warning = core.notifications.get().find((n) => n.source.kind === "module" && n.source.code === "graph_state_dropped");
    expect(warning).toMatchObject({ severity: "warning", about: { plugin: GRAPH } });
    expect(warning?.message).toContain('the position of the block "gone"');
    expect(warning?.message).toContain('the entry of the stack "s9"');
    expect(stub?.logged).toContainEqual(expect.objectContaining({ level: "warn", package: "blockr.graph", message: warning?.message }));
    expect(warned).toHaveLength(1);
    expect(core.store.canUndo()).toBe(false);
  });

  test("raises no warning on a board whose state fits it", async () => {
    const { core } = await start(placed);
    expect(core.notifications.get().filter((n) => n.source.kind === "module")).toEqual([]);
  });
});

describe("the class as steps change the board", () => {
  test("places a block that a batch adds and then links by that link, in one undo step", async () => {
    const { core } = await start(placed);
    await core.commands.run([
      { id: core.id("blockr.core", "add_block"), args: { registry_id: { package: "blockr.core", id: "head_block" }, id: "n" } },
      { id: core.id("blockr.core", "add_link"), args: { from: "f", to: "n" } },
    ]);
    // Block f feeds no other block. Block a feeds f and sits left of it in
    // the row, so the link into f runs across, and n starts one rank to the
    // right of f.
    const at = dag(core).positions.n;
    expect(at?.y).toBe(0);
    expect(at?.x).toBeGreaterThan(150 * 5);
    core.store.undo();
    expect(core.store.board().blocks.n).toBeUndefined();
    expect(dag(core).positions).toEqual(ROW);
  });

  test("starts a block at the position that the same step gives it, and makes room around it", async () => {
    const { core } = await start(placed);
    await core.commands.run([
      { id: core.id("blockr.core", "add_block"), args: { registry_id: { package: "blockr.core", id: "head_block" }, id: "n" } },
      { id: core.id("blockr.graph", "change_position"), args: { positions: { n: { x: 300, y: 0 } } } },
    ]);
    expect(dag(core).positions.n).toEqual({ x: 300, y: 0 });
    expect(dag(core).positions.c).not.toEqual(ROW.c);
    core.store.undo();
    expect(dag(core).positions).toEqual(ROW);
  });

  test("drops the position of a block that a step removes, which undo puts back", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.core", "remove_block"), { id: "c" });
    expect(dag(core).positions.c).toBeUndefined();
    core.store.undo();
    expect(dag(core).positions.c).toEqual(ROW.c);
  });

  test("gives a stack that a step empties a position where its box was", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.core", "change_stack"), { id: "s1", blocks: [] });
    const entry = dag(core).stacks.s1;
    expect(entry).toEqual({ x: 75, y: 0 });
  });
});

describe("the DAG's commands", () => {
  test("move blocks, and stacks that hold no block, in an undo step", async () => {
    const { core } = await start(placed);
    const took = await core.commands.run(core.id("blockr.graph", "change_position"), {
      positions: { a: { x: 1, y: 2 } },
      stacks: { s2: { x: 3, y: 4 } },
    });
    expect(took).toBe(true);
    expect(dag(core).positions.a).toEqual({ x: 1, y: 2 });
    expect(dag(core).stacks.s2).toEqual({ x: 3, y: 4 });
  });

  test("round the positions given while snapping is on", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.graph", "set_snap"), { snap: true, snap_size: 25 });
    await core.commands.run(core.id("blockr.graph", "change_position"), { positions: { a: { x: 13, y: 37 } } });
    expect(dag(core).positions.a).toEqual({ x: 25, y: 25 });
  });

  test.each([
    ["a block that the board lacks", { positions: { gone: { x: 0, y: 0 } } }, 'The board holds no block "gone".'],
    ["a stack that the board lacks", { stacks: { gone: { x: 0, y: 0 } } }, 'The board holds no stack "gone".'],
    ["a position for a stack that holds blocks", { stacks: { s1: { x: 0, y: 0 } } }, 'The stack "s1" holds blocks'],
  ])("refuse to move %s", async (_, args, message) => {
    const { core } = await start(placed);
    expect(core.commands.preflight(core.id("blockr.graph", "change_position"), args)).toBe(false);
    await expect(core.commands.run(core.id("blockr.graph", "change_position"), args)).rejects.toThrow(message);
  });

  test("lay the board out again with the settings given, which one undo takes back", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.graph", "relayout"), { direction: "LR", spacing: "compact" });
    const laid = dag(core);
    expect(laid.layout).toMatchObject({ direction: "LR", spacing: "compact" });
    expect(laid.positions).not.toEqual(ROW);
    expect(laid.positions.b?.x).toBeGreaterThan(laid.positions.a?.x ?? Infinity);
    core.store.undo();
    expect(dag(core).positions).toEqual(ROW);
    expect(dag(core).layout).toEqual(defaultState.layout);
  });

  test("set the placement and the snapping without an undo step", async () => {
    const { core } = await start(placed);
    expect(await core.commands.run(core.id("blockr.graph", "set_placement"), { placement: "beside" })).toBe(false);
    expect(await core.commands.run(core.id("blockr.graph", "set_snap"), { snap: true })).toBe(false);
    expect(dag(core).layout).toMatchObject({ placement: "beside", snap: true });
    expect(dag(core).positions).toEqual(ROW);
    expect(core.store.canUndo()).toBe(false);
  });

  test("collapse a stack, and expand it again, putting back what its collapse moved", async () => {
    const { core } = await start(placed);
    expect(await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: true })).toBe(true);
    const entry = dag(core).stacks.s1;
    expect(entry !== undefined && isCollapse(entry) && entry.collapsed).toBe(1);
    await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: false });
    expect(dag(core).stacks.s1).toBeUndefined();
    const back = dag(core).positions;
    for (const block of BLOCKS) expect(distance(back[block], ROW[block])).toBeLessThan(1);
  });

  test("collapse a stack in one undo step, which takes back all that it moved", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: true });
    expect(dag(core).positions).not.toEqual(ROW);
    core.store.undo();
    expect(dag(core).positions).toEqual(ROW);
    expect(dag(core).stacks.s1).toBeUndefined();
  });

  test("drop a block that someone moves from what each collapse moved, so that no expand puts it back", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: true });
    const [block = "c"] = Object.keys(collapseOf(core, "s1").moved.positions);
    await core.commands.run(core.id("blockr.graph", "change_position"), { positions: { [block]: { x: 900, y: 900 } } });
    expect(collapseOf(core, "s1").moved.positions[block]).toBeUndefined();
    await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: false });
    expect(dag(core).positions[block]).toEqual({ x: 900, y: 900 });
  });

  test("empty what each collapse moved as they lay the board out again", async () => {
    const { core } = await start(placed);
    await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: true });
    expect(Object.keys(collapseOf(core, "s1").moved.positions)).not.toEqual([]);
    await core.commands.run(core.id("blockr.graph", "relayout"), {});
    expect(collapseOf(core, "s1")).toEqual({ collapsed: 1, moved: { positions: {}, stacks: {} } });
  });

  test("change nothing for a stack that shows as asked already", async () => {
    const { core } = await start(placed);
    expect(await core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack: "s1", collapsed: false })).toBe(false);
  });

  test.each([
    ["a stack that holds no block", "s2", 'The stack "s2" holds no block'],
    ["a stack that the board lacks", "gone", 'The board holds no stack "gone".'],
  ])("refuse to collapse %s", async (_, stack, message) => {
    const { core } = await start(placed);
    await expect(core.commands.run(core.id("blockr.graph", "collapse_stack"), { stack, collapsed: true })).rejects.toThrow(message);
  });

  test("lock nothing of their own on a locked board, where the store still refuses what the board lock fixes", async () => {
    const { core } = await start(placed, { board: true, load: false });
    for (const [id, args] of [
      ["change_position", { positions: { a: { x: 0, y: 0 } } }],
      ["relayout", {}],
      ["set_placement", { placement: "beside" }],
      ["set_snap", { snap: true }],
      ["collapse_stack", { stack: "s1", collapsed: true }],
    ] as const) {
      expect(core.commands.preflight(core.id("blockr.graph", id), args)).toBe(true);
      await core.commands.run(core.id("blockr.graph", id), args);
    }
    expect(dag(core).stacks.s1).toBeDefined();
    await expect(core.commands.run(core.id("blockr.core", "remove_block"), { id: "c" })).rejects.toThrow();
  });
});

// The collapse of the stack in the DAG's state on the open board.
function collapseOf(core: CoreApi, stack: string): Collapse {
  const entry = dag(core).stacks[stack];
  if (entry === undefined || !isCollapse(entry)) throw new Error(`The stack "${stack}" shows expanded.`);
  return entry;
}

function distance(a: Point | undefined, b: Point | undefined): number {
  return a === undefined || b === undefined ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
}
