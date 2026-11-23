// The DAG plugin's class on blockr.core's CoreApi for tests, which opens a
// board as the page of an app that runs the DAG would, with R played from the
// fixtures of core's wire protocol, so that the tests need neither R nor a
// browser (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.12#testing).
// The store checks the DAG's state against the schema that the class gives,
// the file that the build writes for R.

import type { Json, JsonBoard } from "@blockr/core";
import { HELLO, stubCore } from "@blockr/core/stubs";
import type { StubCore } from "@blockr/core/stubs";
import { afterEach, describe, expect, test } from "vitest";
import { defaultState } from "../../state/index.ts";
import type { GraphState } from "../../state/index.ts";
import * as graph from "./index.ts";

const GRAPH = "blockr.graph-graph_plugin";

// R's reply to hello in an app that runs the DAG beside core's plugins.
// The entry of the DAG plugin's class gives its name, the version of its
// state, 1, and where R serves its module.
const hello = {
  ...HELLO,
  packages: { ...HELLO.packages, "blockr.graph": "0.2.0" },
  plugins: {
    ...HELLO.plugins,
    [GRAPH]: { name: "Workflow", version: 1, options: [], module: "blockr.graph/js/graph.js" },
  },
};

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
// state given.
function boardWith(plugins: JsonBoard["board"]["plugins"]): JsonBoard {
  const { board } = HELLO.board;
  return {
    ...HELLO.board,
    packages: { ...HELLO.board.packages, "blockr.graph": "0.2.0" },
    board: { ...board, stacks: { ...board.stacks, s2: { name: "Empty", blocks: [], color: null } }, plugins },
  };
}

let stub: StubCore | undefined;

async function start(board?: JsonBoard): Promise<StubCore> {
  stub = await stubCore({ hello: board === undefined ? hello : { ...hello, board }, modules: { [GRAPH]: graph } });
  return stub;
}

afterEach(() => {
  stub?.stop();
  stub = undefined;
});

describe("the DAG plugin's class", () => {
  test("exports the JS API major that it was built against", () => {
    expect(graph.api).toBe(1);
  });

  test("gives a board that holds no state for the DAG the default state", async () => {
    const { core } = await start();
    expect(core.store.board().plugins[GRAPH]).toEqual(defaultState);
  });

  test("keeps the state that a board holds for the DAG", async () => {
    const { core } = await start(boardWith({ [GRAPH]: { state, version: 1 } }));
    expect(core.store.board().plugins[GRAPH]).toEqual(state);
  });

  test("lets the state change as its schema allows", async () => {
    const { core } = await start();
    const patches: Json = [
      { op: "add", path: "/positions/a", value: { x: 40, y: 80 } },
      { op: "add", path: "/stacks/s1", value: { collapsed: 1, moved: { positions: {}, stacks: {} } } },
      { op: "replace", path: "/layout/snap_size", value: 10 },
    ];
    await core.commands.run("blockr.core-set_plugin_state", { plugin: GRAPH, patches });
    expect(core.store.board().plugins[GRAPH]).toEqual({
      positions: { a: { x: 40, y: 80 } },
      stacks: { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } } },
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
    const { core } = await start();
    const run = core.commands.run("blockr.core-set_plugin_state", { plugin: GRAPH, patches: [patch] });
    await expect(run).rejects.toThrow(`The state of the plugin "${GRAPH}"`);
    expect(core.store.board().plugins[GRAPH]).toEqual(defaultState);
  });
});
