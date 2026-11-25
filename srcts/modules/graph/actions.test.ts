// The DAG's board actions on blockr.core's CoreApi for tests, which runs their
// menus as on the page and draws none, so that the tests pick their rows by
// label (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.16#testing).
// On happy-dom, the page has a clipboard that reads what it was written.
//
// The fixture's board holds the blocks a, Iris; b, Head; c, Merge; d, Wide
// sepals; e, Bind; and f, Scatter. Its links are ab, ac, bc, ad, be, de and
// keen_finch, from a to f, and its stack s1, Input, holds a and b.

import type { CoreApi, JsonBoard } from "@blockr/core";
import { HELLO, stubCore } from "@blockr/core/stubs";
import type { StubCore } from "@blockr/core/stubs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { COPY, CUT, LAYOUT, notePoint, onFit, PASTE } from "../../actions/index.ts";
import { defaultState, GRAPH } from "../../state/index.ts";
import type { GraphState } from "../../state/index.ts";
import * as graph from "./index.ts";

const POSITIONS: GraphState["positions"] = {
  a: { x: 0, y: 0 },
  b: { x: 0, y: 150 },
  c: { x: 150, y: 300 },
  d: { x: 300, y: 150 },
  e: { x: 150, y: 450 },
  f: { x: 450, y: 150 },
};

// The fixture's board, with the DAG's state at the positions above.
const board: JsonBoard = {
  ...HELLO.board,
  packages: { ...HELLO.board.packages, "blockr.graph": "0.2.0" },
  board: { ...HELLO.board.board, plugins: { [GRAPH]: { state: { ...defaultState, positions: POSITIONS }, version: 1 } } },
};

let stub: StubCore | undefined;

async function start(lock = HELLO.lock): Promise<StubCore> {
  stub = await stubCore({
    hello: {
      ...HELLO,
      lock,
      board,
      packages: { ...HELLO.packages, "blockr.graph": "0.2.0" },
      plugins: { ...HELLO.plugins, [GRAPH]: { name: "Workflow", version: 1, options: [], module: "blockr.graph/js/graph.js" } },
    },
    modules: { [GRAPH]: graph },
  });
  return stub;
}

afterEach(async () => {
  stub?.stop();
  stub = undefined;
  vi.restoreAllMocks();
  await navigator.clipboard.writeText("");
});

function dag(core: CoreApi): GraphState {
  return core.store.board().plugins[GRAPH] as GraphState;
}

// The ids of the board actions that a menu of the target offers.
function offered(core: CoreApi, target: Parameters<CoreApi["boardActions"]["on"]>[0]): string[] {
  return core.boardActions.on(target).map((action) => action.id);
}

function paste(core: CoreApi): Promise<void> {
  return core.boardActions.trigger(PASTE, { board: true }, { el: document.body });
}

describe("Copy", () => {
  test("puts a JSON board of what it acts on on the clipboard, with their positions, and changes nothing", async () => {
    const { core } = await start();
    await stub?.menu({ stack: "s1" }).pick("Copy");
    const copied = JSON.parse(await navigator.clipboard.readText()) as JsonBoard;
    expect(Object.keys(copied.board.blocks)).toEqual(["a", "b"]);
    expect(Object.keys(copied.board.links)).toEqual(["ab"]);
    expect(Object.keys(copied.board.stacks)).toEqual(["s1"]);
    expect((copied.board.plugins[GRAPH]?.state as GraphState).positions).toEqual({ a: POSITIONS.a, b: POSITIONS.b });
    expect(core.store.canUndo()).toBe(false);
  });

  test("and Cut are offered on a block, a stack or a selection that holds one, but on no link", async () => {
    const { core } = await start();
    expect(offered(core, { block: "a" })).toEqual(expect.arrayContaining([COPY, CUT]));
    expect(offered(core, { selection: [{ block: "a" }, { link: "ab" }] })).toEqual(expect.arrayContaining([COPY, CUT]));
    expect(offered(core, { link: "ab" })).not.toContain(COPY);
    expect(offered(core, { selection: [{ link: "ab" }] })).not.toContain(CUT);
  });
});

describe("Cut", () => {
  test("copies, then removes what it copied in one step", async () => {
    const { core } = await start();
    await stub?.menu({ stack: "s1" }).pick("Cut");
    const cut = core.store.board();
    expect(Object.keys(cut.blocks).sort()).toEqual(["c", "d", "e", "f"]);
    expect(cut.stacks).toEqual({});
    expect(Object.keys((JSON.parse(await navigator.clipboard.readText()) as JsonBoard).board.blocks)).toEqual(["a", "b"]);
    core.store.undo();
    expect(Object.keys(core.store.board().blocks).sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(Object.keys(core.store.board().stacks)).toEqual(["s1"]);
  });
});

describe("Paste", () => {
  test("adds what was copied under new ids, with its middle where the user pastes, in one step", async () => {
    const { core } = await start();
    await stub?.menu({ stack: "s1" }).pick("Copy");
    notePoint({ x: 1000, y: 1000 });
    await paste(core);
    const pasted = core.store.board();
    const added = Object.keys(pasted.blocks).filter((id) => !Object.hasOwn(POSITIONS, id));
    expect(added.map((id) => pasted.blocks[id]?.name)).toEqual(["Iris", "Head"]);
    const [iris, head] = added;
    const stack = Object.values(pasted.stacks).find((each) => each.name === "Input (copy)");
    expect(stack?.blocks).toEqual(added);
    expect(Object.values(pasted.links).filter((link) => link.from === iris && link.to === head)).toHaveLength(1);
    // The copied blocks sat at 0, 0 and 0, 150, so their middle was at 0, 75.
    expect(dag(core).positions[iris ?? ""]).toEqual({ x: 1000, y: 925 });
    expect(dag(core).positions[head ?? ""]).toEqual({ x: 1000, y: 1075 });
    core.store.undo();
    expect(Object.keys(core.store.board().blocks).sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  test("leaves the board alone where the clipboard holds no JSON board", async () => {
    const { core } = await start();
    await navigator.clipboard.writeText("Iris");
    await paste(core);
    expect(Object.keys(core.store.board().blocks)).toHaveLength(6);
    expect(core.store.canUndo()).toBe(false);
  });

  test("takes the page's last copy where the browser refuses to read the clipboard", async () => {
    const { core } = await start();
    await stub?.menu({ block: "f" }).pick("Copy");
    vi.spyOn(navigator.clipboard, "readText").mockRejectedValue(new DOMException("Refused", "NotAllowedError"));
    await paste(core);
    expect(Object.values(core.store.board().blocks).filter((block) => block.name === "Scatter")).toHaveLength(2);
  });

  test("leaves out a block whose class the app lacks", async () => {
    const { core } = await start();
    const json = core.store.jsonBoard();
    const iris = json.board.blocks.a;
    if (iris === undefined) throw new Error("The fixture holds no block a.");
    const text = JSON.stringify({
      ...json,
      board: {
        ...json.board,
        blocks: { a: iris, z: { ...iris, registry_id: "blockr.ghost-ghost_block", name: "Ghost" } },
        links: {},
        stacks: {},
        options: {},
        plugins: {},
      },
    });
    await navigator.clipboard.writeText(text);
    await paste(core);
    const names = Object.values(core.store.board().blocks).map((block) => block.name);
    expect(names.filter((name) => name === "Iris")).toHaveLength(2);
    expect(names).not.toContain("Ghost");
  });
});

describe("Layout", () => {
  test("checks the current direction, spacing and placement, and snapping where it is on", async () => {
    await start();
    const menu = stub?.menu({ board: true });
    await menu?.pick("Layout");
    const rows = menu?.level()?.rows ?? [];
    const checked = rows.flatMap((row) => (row.kind === "item" && row.checked === true ? [row.label] : []));
    expect(checked).toEqual(["Top to bottom", "Normal", "Repulsion"]);
    expect(rows.find((row) => row.label === "Snap to grid")).toMatchObject({ checked: false });
    expect(menu?.level()?.title).toBe("Layout");
  });

  test("lays the board out again in the direction that the user picks, as one step, and fits the view", async () => {
    const { core } = await start();
    const fit = vi.fn();
    const off = onFit(fit);
    const menu = stub?.menu({ board: true });
    await menu?.pick("Layout");
    await menu?.pick("Left to right");
    off();
    expect(dag(core).layout.direction).toBe("LR");
    expect(dag(core).positions).not.toEqual(POSITIONS);
    expect(fit).toHaveBeenCalledOnce();
    expect(menu?.closed()).toBe(true);
    core.store.undo();
    expect(dag(core).positions).toEqual(POSITIONS);
  });

  test("sets the placement of new blocks and snapping, which take no undo step", async () => {
    const { core } = await start();
    const pick = async (...labels: string[]) => {
      const menu = stub?.menu({ board: true });
      for (const label of labels) await menu?.pick(label);
      return menu;
    };
    await pick("Layout", "Beside");
    await pick("Layout", "Snap to grid");
    expect(dag(core).layout).toMatchObject({ placement: "beside", snap: true });
    const size = await pick("Layout", "Snap size…");
    size?.type("0", "Snap size in pixels");
    await size?.pick("Snap size in pixels");
    expect(size?.level()?.rows[0]).toMatchObject({ refusal: "The snap size is a number of pixels above 0." });
    size?.type("40", "Snap size in pixels");
    await size?.pick("Snap size in pixels");
    expect(dag(core).layout.snap_size).toBe(40);
    expect(core.store.canUndo()).toBe(false);
  });
});

describe("on a locked board", () => {
  test("Cut and Paste are offered nowhere, while Copy and Layout stay", async () => {
    const { core } = await start({ board: true, load: false });
    expect(offered(core, { block: "a" })).toContain(COPY);
    expect(offered(core, { block: "a" })).not.toContain(CUT);
    expect(offered(core, { board: true })).toContain(LAYOUT);
    expect(offered(core, { board: true })).not.toContain(PASTE);
  });
});
