// The `ui` of the DAG plugin's class on blockr.core's CoreApi for tests,
// mounted as a frontend places a plugin's `ui`, on happy-dom, which lays
// nothing out (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#testing).
// React Flow draws there without measuring anything, since the DAG gives it
// the size of every node and where each handle sits. The gestures that drag
// run in a browser instead, in the end-to-end tests of tests/testthat.
//
// The fixture's board holds the blocks a, Iris, a dataset block; b, Head; c,
// Merge, with the inputs x and y; d, Wide sepals; e, Bind, a variadic block;
// and f, Scatter. Its links are ab, ac (x), bc (y), ad, be, de and keen_finch
// (a to f), and its stack s1, Input, holds a and b.

import type { CoreApi, JsonBoard } from "@blockr/core";
import { HELLO, stubCore } from "@blockr/core/stubs";
import type { StubCore } from "@blockr/core/stubs";
import { find, menuItem, menuItems, openMenu, pointerPress, rowOf, rowTexts, step, type } from "@blockr/ui/stubs";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BLOCK_HEIGHT, blockWidth } from "../../geometry/index.ts";
import { defaultState, GRAPH } from "../../state/index.ts";
import type { GraphState } from "../../state/index.ts";
import * as graph from "./index.ts";

// R's reply to hello, as core's fixture holds it.
type HelloReply = typeof HELLO;

const POSITIONS: GraphState["positions"] = {
  a: { x: 0, y: 0 },
  b: { x: 0, y: 150 },
  c: { x: 150, y: 300 },
  d: { x: 300, y: 150 },
  e: { x: 150, y: 450 },
  f: { x: 450, y: 150 },
};

// R's reply to hello in an app that runs the DAG, on the board of the fixture
// with the DAG's state given, the lock given, and the blocks given left out.
function helloWith(state: Partial<GraphState> | undefined, lock = HELLO.lock, without: readonly string[] = []): HelloReply {
  const { board } = HELLO.board;
  const blocks = Object.fromEntries(Object.entries(board.blocks).filter(([id]) => !without.includes(id)));
  const links = Object.fromEntries(Object.entries(board.links).filter(([, link]) => !without.includes(link.from) && !without.includes(link.to)));
  const stacks = Object.fromEntries(
    Object.entries(board.stacks).map(([id, stack]) => [id, { ...stack, blocks: stack.blocks.filter((block) => !without.includes(block)) }]),
  );
  const json: JsonBoard = {
    ...HELLO.board,
    packages: { ...HELLO.board.packages, "blockr.graph": "0.2.0" },
    board: {
      ...board,
      blocks,
      links,
      stacks,
      plugins: state === undefined ? {} : { [GRAPH]: { state: { ...defaultState, ...state }, version: 1 } },
    },
  };
  return {
    ...HELLO,
    lock,
    board: json,
    packages: { ...HELLO.packages, "blockr.graph": "0.2.0" },
    plugins: { ...HELLO.plugins, [GRAPH]: { name: "Workflow", version: 1, options: [], module: "blockr.graph/js/graph.js" } },
  };
}

interface Mounted {
  readonly el: HTMLElement;
  readonly core: CoreApi;
  readonly stub: StubCore;
  readonly end: () => void;
}

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0).reverse()) stop();
  document.body.replaceChildren();
});

// The DAG's UI mounted in an element of the page, as a frontend places it, in
// an app whose other modules are those given beside core's.
async function mounted(hello: HelloReply = helloWith({ positions: POSITIONS }), modules: Readonly<Record<string, unknown>> = {}): Promise<Mounted> {
  const stub = await act(() => stubCore({ hello, modules: { [GRAPH]: graph, ...modules } }));
  stops.push(stub.stop);
  const el = document.createElement("div");
  document.body.append(el);
  let end = (): void => undefined;
  await act(async () => {
    end = stub.core.mountPlugin(el, GRAPH);
    await stub.settled();
  });
  stops.push(() => {
    act(() => {
      end();
    });
  });
  return { el, core: stub.core, stub, end };
}

function nodeIds(el: HTMLElement): string[] {
  return [...el.querySelectorAll<HTMLElement>(".react-flow__node")].map((node) => node.dataset.id ?? "").sort();
}

function edgeIds(el: HTMLElement): string[] {
  return [...el.querySelectorAll<HTMLElement>(".react-flow__edge")].map((edge) => edge.dataset.id ?? "").sort();
}

function nodeOf(el: HTMLElement, id: string): HTMLElement {
  const node = el.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (node === null) throw new Error(`The DAG draws no node ${id}`);
  return node;
}

function selected(el: HTMLElement): string[] {
  return [...el.querySelectorAll<HTMLElement>(".react-flow__node.selected, .react-flow__edge.selected")].map((each) => each.dataset.id ?? "");
}

async function click(target: Element, init: MouseEventInit = {}): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
    await Promise.resolve();
  });
}

function button(el: HTMLElement, label: string): HTMLElement {
  const found = el.querySelector<HTMLElement>(`button[aria-label="${label}"]`);
  if (found === null) throw new Error(`No button ${label}`);
  return found;
}

describe("the DAG's canvas", () => {
  test("draws a node for each block, the stack's box, and an edge for each link", async () => {
    const { el } = await mounted();
    expect(nodeIds(el)).toEqual(["b:a", "b:b", "b:c", "b:d", "b:e", "b:f", "s:s1"]);
    expect(edgeIds(el)).toEqual(["l:ab", "l:ac", "l:ad", "l:bc", "l:be", "l:de", "l:keen_finch"]);
  });

  test("draws a block's mark in its category, its name and its status dot", async () => {
    const { el } = await mounted();
    const a = nodeOf(el, "b:a");
    expect(a.querySelector(".blockr-graph-mark")?.getAttribute("data-category")).toBe("input");
    expect(a.querySelector(".blockr-graph-name")?.textContent).toBe("Iris");
    expect(a.querySelector(".blockr-graph-dot")?.getAttribute("data-status")).toMatch(/^(ready|unevaluated|stale|waiting|invalid|failed)$/);
  });

  test("draws a stack in a default colour of its own where core keeps none on it, with its name", async () => {
    const { el } = await mounted();
    const s1 = nodeOf(el, "s:s1").querySelector<HTMLElement>(".blockr-graph-stack");
    expect(s1?.dataset.shows).toBe("expanded");
    expect(s1?.style.getPropertyValue("--blockr-graph-stack-color")).toBe("var(--bk-color-border)");
    expect(s1?.querySelector(".blockr-graph-stack-name")?.textContent).toBe("Input");
  });

  test("draws no node for a block until the class's start gives it a position", async () => {
    const { el, core } = await mounted(helloWith(undefined));
    await vi.waitFor(() => {
      expect(nodeIds(el)).toHaveLength(7);
    });
    const { positions } = core.store.board().plugins[GRAPH] as GraphState;
    expect(Object.keys(positions).sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  test("follows every change of the board, whoever makes it", async () => {
    const { el, core } = await mounted();
    await act(() => core.commands.run("blockr.core-remove_link", { id: "keen_finch" }));
    expect(edgeIds(el)).not.toContain("l:keen_finch");
    await act(() => core.commands.run("blockr.core-remove_block", { id: "f" }));
    expect(nodeIds(el)).not.toContain("b:f");
    await act(() => core.commands.run("blockr.graph-change_position", { positions: { d: { x: 600, y: 600 } } }));
    // React Flow places the node by its top left corner, half its size from
    // the block's position.
    const [left, top] = [600 - blockWidth("Wide sepals") / 2, 600 - BLOCK_HEIGHT / 2];
    expect(nodeOf(el, "b:d").style.transform).toBe(`translate(${String(left)}px,${String(top)}px)`);
  });

  test("says that the board holds no block, and how to add one but under the board lock", async () => {
    const all = ["a", "b", "c", "d", "e", "f"];
    const open = await mounted(helloWith({}, HELLO.lock, all));
    expect(open.el.querySelector(".blockr-graph-empty")?.textContent).toBe("No blocks yet. Right-click to add one.");
    const locked = await mounted(helloWith({}, { ...HELLO.lock, board: true }, all));
    expect(locked.el.querySelector(".blockr-graph-empty")?.textContent).toBe("No blocks yet.");
  });

  test("takes a height of its own where its element has none", async () => {
    const { el } = await mounted();
    // On happy-dom, every element measures 0 by 0.
    expect(el.querySelector(".blockr-graph")?.getAttribute("data-height")).toBe("own");
  });
});

describe("the selection", () => {
  test("draws what core.selection holds, whoever set it", async () => {
    const { el, core } = await mounted();
    act(() => {
      core.selection.set([{ block: "c" }, { link: "ab" }, { stack: "s1" }]);
    });
    expect(selected(el).sort()).toEqual(["b:c", "l:ab", "s:s1"]);
  });

  test("takes a click on a block, and shows the block that the user selects alone", async () => {
    const { el, core } = await mounted();
    const show = vi.spyOn(core, "show");
    await click(nodeOf(el, "b:c"));
    expect(core.selection.get()).toEqual([{ block: "c" }]);
    expect(show).toHaveBeenCalledWith({ block: "c" });
    expect(selected(el)).toEqual(["b:c"]);
  });

  test("shows no stack that the user selects", async () => {
    const { el, core } = await mounted();
    const show = vi.spyOn(core, "show");
    await click(nodeOf(el, "s:s1"));
    expect(core.selection.get()).toEqual([{ stack: "s1" }]);
    expect(show).not.toHaveBeenCalled();
  });

  test("selects no text on the page while a drag that starts on it goes on", async () => {
    const { el } = await mounted();
    const selecting = () => !document.dispatchEvent(new Event("selectstart", { cancelable: true }));
    pane(el).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(selecting()).toBe(true);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(selecting()).toBe(false);
  });

  test("is cleared by a click on the canvas", async () => {
    const { el, core } = await mounted();
    act(() => {
      core.selection.set([{ block: "c" }, { option: "n_rows" }]);
    });
    const pane = el.querySelector(".react-flow__pane");
    if (pane === null) throw new Error("No pane");
    await click(pane);
    expect(core.selection.get()).toEqual([]);
  });
});

describe("a stack", () => {
  test("collapses and expands on a double click on its box", async () => {
    const { el, core } = await mounted();
    await act(async () => {
      nodeOf(el, "s:s1").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(nodeIds(el)).toEqual(["b:c", "b:d", "b:e", "b:f", "s:s1"]);
    });
    expect((core.store.board().plugins[GRAPH] as GraphState).stacks.s1).toMatchObject({ collapsed: 1 });
    expect(nodeOf(el, "s:s1").querySelector(".blockr-graph-stack-count")?.textContent).toBe("2 blocks");
    // The links from a and b to blocks outside the stack end on its box.
    const ends = [...el.querySelectorAll<HTMLElement>(".react-flow__edge")].map((edge) => edge.getAttribute("aria-label"));
    expect(ends).toContain("Edge from s:s1 to b:c");
    await act(async () => {
      nodeOf(el, "s:s1").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(nodeIds(el)).toHaveLength(7);
    });
  });

  test("collapses through the button on its box", async () => {
    const { el, core } = await mounted();
    await pointerPress(button(el, "Collapse Input"));
    await vi.waitFor(() => {
      expect((core.store.board().plugins[GRAPH] as GraphState).stacks.s1).toMatchObject({ collapsed: 1 });
    });
    expect(button(el, "Expand Input")).toBeDefined();
  });
});

describe("a handle", () => {
  test("shows the link that feeds its input as the pointer enters it", async () => {
    const { el } = await mounted();
    const handle = nodeOf(el, "b:c").querySelector('.react-flow__handle[data-handleid="in:x#ac"]');
    if (handle === null) throw new Error("No handle");
    await act(async () => {
      handle.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
      await Promise.resolve();
    });
    expect(el.querySelector('.react-flow__edge[data-id="l:ac"]')?.classList.contains("blockr-graph-hovered")).toBe(true);
    await act(async () => {
      handle.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" }));
      await Promise.resolve();
    });
    expect(el.querySelector(".blockr-graph-hovered")).toBeNull();
  });

  test("of a crowded side spreads the side out while the pointer is over it, and folds it back once it leaves", async () => {
    const { el, core } = await mounted();
    // Three more links into the variadic block e, all from above it, crowd
    // the top of its mark with six handles.
    for (const from of ["a", "c", "f"]) {
      await act(() => core.commands.run("blockr.core-add_link", { from, to: "e" }));
    }
    const lefts = () =>
      [...nodeOf(el, "b:e").querySelectorAll<HTMLElement>('.react-flow__handle[data-handlepos="top"]')].map((handle) => parseFloat(handle.style.left));
    const crowded = lefts();
    expect(crowded).toHaveLength(6);
    const gaps = (at: number[]) => at.slice(1).map((left, i) => left - (at[i] ?? 0));
    expect(Math.max(...gaps(crowded))).toBeLessThan(12);
    const handle = nodeOf(el, "b:e").querySelector('.react-flow__handle[data-handlepos="top"]');
    if (handle === null) throw new Error("No handle");
    await act(async () => {
      handle.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
      await Promise.resolve();
    });
    expect(gaps(lefts())).toEqual([12, 12, 12, 12, 12]);
    vi.useFakeTimers();
    try {
      act(() => {
        handle.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" }));
      });
      // The side stays spread for a moment, so that the pointer moves to the
      // next handle without it folding back between them.
      expect(gaps(lefts())).toEqual([12, 12, 12, 12, 12]);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lefts()).toEqual(crowded);
    } finally {
      vi.useRealTimers();
    }
  });

  test("takes no link under the board lock", async () => {
    const open = await mounted();
    expect(open.el.querySelectorAll(".react-flow__handle.connectable").length).toBeGreaterThan(0);
    const locked = await mounted(helloWith({ positions: POSITIONS }, { ...HELLO.lock, board: true }));
    expect(locked.el.querySelectorAll(".react-flow__handle.connectable")).toHaveLength(0);
  });
});

describe("search and the outline", () => {
  // The panel of search and the outline.
  function searchPanel(el: HTMLElement): HTMLElement {
    return find(el, ".blockr-graph-search");
  }

  function field(el: HTMLElement): HTMLInputElement {
    return find(searchPanel(el), "input", HTMLInputElement);
  }

  // Types the text into the field of search, as a user does.
  async function search(el: HTMLElement, text: string): Promise<void> {
    await step(() => {
      type(field(el), text);
    });
  }

  test("lists each stack with its blocks, and then the blocks in no stack, as the toolbar's button opens it", async () => {
    const { el } = await mounted();
    expect(el.querySelector(".blockr-graph-search")).toBeNull();
    await pointerPress(button(el, "Search blocks"));
    expect(el.querySelector(".blockr-graph-search-heading")?.textContent).toBe("Board contents");
    expect(rowTexts(searchPanel(el))).toEqual(["Input (2)", "Iris", "Head", "Merge", "Wide sepals", "Bind", "Scatter"]);
  });

  test("narrows to the stacks and the blocks whose name or id holds what the user types", async () => {
    const { el } = await mounted();
    await pointerPress(button(el, "Search blocks"));
    await search(el, "in");
    expect(rowTexts(searchPanel(el))).toEqual(["Input (2)", "Bind"]);
    await search(el, "zzz");
    expect(el.querySelector(".blockr-graph-search-none")?.textContent).toBe("No block or stack matches.");
  });

  test("selects and shows the block that the user picks, and closes", async () => {
    const { el, core } = await mounted();
    const show = vi.spyOn(core, "show");
    await pointerPress(button(el, "Search blocks"));
    await search(el, "merge");
    await pointerPress(rowOf(searchPanel(el), "Merge"));
    await vi.waitFor(() => {
      expect(core.selection.get()).toEqual([{ block: "c" }]);
    });
    expect(show).toHaveBeenCalledWith({ block: "c" });
    expect(el.querySelector(".blockr-graph-search")).toBeNull();
  });

  test("expands the collapsed stack of the block that the user picks first", async () => {
    const collapsed = { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } } };
    const { el, core } = await mounted(helloWith({ positions: POSITIONS, stacks: collapsed }));
    await pointerPress(button(el, "Search blocks"));
    // The outline shows the stack folded, as the canvas does.
    expect(rowTexts(searchPanel(el))).toEqual(["Input (2)", "Merge", "Wide sepals", "Bind", "Scatter"]);
    await search(el, "head");
    await pointerPress(rowOf(searchPanel(el), "Head"));
    await vi.waitFor(() => {
      expect(core.selection.get()).toEqual([{ block: "b" }]);
    });
    expect((core.store.board().plugins[GRAPH] as GraphState).stacks.s1).toBeUndefined();
    expect(nodeIds(el)).toContain("b:b");
  });

  test("closes on Escape", async () => {
    const { el } = await mounted();
    await pointerPress(button(el, "Search blocks"));
    await act(async () => {
      el.querySelector(".blockr-graph-search")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await Promise.resolve();
    });
    expect(el.querySelector(".blockr-graph-search")).toBeNull();
  });
});

// A plugin class of the tests, which lists two board actions beside core's and
// the DAG's: Break, on the board, whose batch the store refuses, since it
// removes a block that the board does not hold, and Probe, on a link, a block
// or the board, whose advanced action shows its target as text, with a button
// that renames block f through its done().
const TESTER = "blockr.test-tester_plugin";
const tester = {
  api: 1,
  default: {
    boardActions: [
      {
        id: "blockr.test-break_action",
        label: "Break",
        on: ["board"],
        category: "edit",
        run: () => [{ id: "blockr.core-remove_block", args: { id: "zz" } }],
      },
      {
        id: "blockr.test-probe_action",
        label: "Probe",
        on: ["link", "block", "board"],
        category: "edit",
        advanced: {
          render({ el, target, done }: { el: HTMLElement; target: unknown; done: (calls?: unknown[]) => Promise<void> }) {
            const shown = document.createElement("p");
            shown.textContent = JSON.stringify(target);
            const apply = document.createElement("button");
            apply.textContent = "Apply";
            apply.addEventListener("click", () => {
              void done([{ id: "blockr.core-change_block", args: { id: "f", name: "Renamed" } }]);
            });
            el.append(shown, apply);
            return () => {
              el.replaceChildren();
            };
          },
        },
      },
    ],
  },
};

// The DAG's UI on the fixture's board, in an app that runs the plugin class of
// the tests as well.
function mountedWithTester(): Promise<Mounted> {
  const hello = helloWith({ positions: POSITIONS });
  const plugins = { ...hello.plugins, [TESTER]: { name: "Tester", version: 1, options: [], module: "blockr.test/js/tester.js" } };
  return mounted({ ...hello, plugins }, { [TESTER]: tester });
}

async function rightClick(target: Element, at = { x: 50, y: 60 }): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y }));
    await Promise.resolve();
  });
}

async function keyDown(target: Element, init: KeyboardEventInit): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    await Promise.resolve();
  });
}

// The labels of the rows that the menu that is open shows.
function rowLabels(stub: StubCore): string[] {
  return stub.menu()?.level()?.rows.map((row) => row.label) ?? [];
}

function pane(el: HTMLElement): Element {
  const found = el.querySelector(".react-flow__pane");
  if (found === null) throw new Error("No pane");
  return found;
}

function frameOf(el: HTMLElement): HTMLElement {
  const found = el.querySelector<HTMLElement>(".blockr-graph");
  if (found === null) throw new Error("No DAG element");
  return found;
}

function names(core: CoreApi): string[] {
  return Object.values(core.store.board().blocks).map((block) => block.name);
}

describe("a right click", () => {
  test("on a node opens its block's menu, with core's board actions and the DAG's", async () => {
    const { el, stub } = await mounted();
    await rightClick(nodeOf(el, "b:c"));
    expect(rowLabels(stub)).toEqual(expect.arrayContaining(["Append block", "Edit inputs", "Copy", "Cut", "Remove block"]));
  });

  test("on a node of a selection of several opens the selection's menu", async () => {
    const { el, core, stub } = await mounted();
    act(() => {
      core.selection.set([{ block: "c" }, { block: "d" }]);
    });
    await rightClick(nodeOf(el, "b:c"));
    expect(rowLabels(stub)).toEqual(expect.arrayContaining(["Create stack", "Copy", "Cut", "Remove"]));
    expect(rowLabels(stub)).not.toContain("Remove block");
  });

  test("on a link or a stack opens its menu", async () => {
    const { el, stub } = await mounted();
    const edge = el.querySelector('.react-flow__edge[data-id="l:ab"]');
    if (edge === null) throw new Error("No edge");
    await rightClick(edge);
    expect(rowLabels(stub)).toEqual(expect.arrayContaining(["Insert block", "Edit link", "Remove link"]));
    await rightClick(nodeOf(el, "s:s1"));
    expect(rowLabels(stub)).toEqual(expect.arrayContaining(["Edit stack", "Copy", "Remove stack"]));
  });

  test("on an input's handle opens the menu of the link that feeds it, or of the input", async () => {
    const { el, stub } = await mounted();
    const fed = nodeOf(el, "b:c").querySelector('.react-flow__handle[data-handleid="in:y#bc"]');
    const next = nodeOf(el, "b:e").querySelector('.react-flow__handle[data-handleid="next"]');
    if (fed === null || next === null) throw new Error("No handle");
    await rightClick(fed);
    expect(rowLabels(stub)).toEqual(expect.arrayContaining(["Edit link", "Remove link"]));
    await rightClick(next);
    expect(rowLabels(stub)).toEqual(["Prepend block", "Create link"]);
  });

  test("on the canvas opens the board's menu, whose additions start where the user right-clicked", async () => {
    const { el, core, stub } = await mounted();
    await rightClick(pane(el), { x: 700, y: 650 });
    expect(rowLabels(stub)).toEqual(expect.arrayContaining(["Add block", "Create stack", "Paste", "Layout"]));
    const menu = stub.menu();
    await act(async () => {
      await menu?.pick("Create stack");
      await menu?.pick("Name");
    });
    const [added] = Object.keys(core.store.board().stacks).filter((id) => id !== "s1");
    // The point on the canvas under the right click, through the view's pan
    // and zoom, which the DAG keeps for the page from an earlier test.
    const [x = 0, y = 0, zoom = 1] = (el.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform.match(/-?[\d.]+/g) ?? []).map(Number);
    expect((core.store.board().plugins[GRAPH] as GraphState).stacks[added ?? ""]).toEqual({ x: (700 - x) / zoom, y: (650 - y) / zoom });
  });

  test("on the canvas of a locked board offers only what the lock leaves", async () => {
    const { el, stub } = await mounted(helloWith({ positions: POSITIONS }, { ...HELLO.lock, board: true }));
    await rightClick(pane(el));
    expect(rowLabels(stub)).toEqual(["Layout"]);
  });

  test("shows why the store refused the batch where the user opened the menu", async () => {
    const { el, stub } = await mountedWithTester();
    await rightClick(pane(el), { x: 300, y: 200 });
    await act(async () => {
      await stub.menu()?.pick("Break").catch(() => undefined);
    });
    const refusal = el.querySelector<HTMLElement>(".blockr-graph-refusal");
    expect(refusal?.textContent).toContain('"zz"');
    expect([refusal?.style.left, refusal?.style.top]).toEqual(["300px", "200px"]);
  });

  test("tells the user that the clipboard holds no board objects to paste through a notification about the board, which a frontend shows as a toast", async () => {
    const { el, core, stub } = await mounted();
    await navigator.clipboard.writeText("");
    await rightClick(pane(el), { x: 300, y: 200 });
    await act(async () => {
      await stub.menu()?.pick("Paste");
    });
    await vi.waitFor(() => {
      expect(core.notifications.get().map(({ severity, message, about }) => ({ severity, message, about }))).toContainEqual({
        severity: "message",
        message: "The clipboard holds no board objects to paste.",
        about: undefined,
      });
    });
    expect(el.querySelector(".blockr-graph-refusal")).toBeNull();
    expect(core.store.canUndo()).toBe(false);
  });
});

describe("the toolbar", () => {
  function hasButton(el: HTMLElement, label: string): boolean {
    return el.querySelector(`button[aria-label="${label}"]`) !== null;
  }

  test("offers its own list of board actions on the board, and on the selection while the user has selected something", async () => {
    const { el, core } = await mountedWithTester();
    for (const label of ["Add to the board", "Paste", "Layout"]) expect(hasButton(el, label)).toBe(true);
    // The board actions of the list's + show in no button of their own, and
    // the board actions of other packages in none at all.
    for (const label of ["Add block", "Create link", "Probe", "Break", "Copy"]) expect(hasButton(el, label)).toBe(false);
    act(() => {
      core.selection.set([{ block: "f" }]);
    });
    for (const label of ["Add the selection to a stack", "Copy", "Cut", "Remove"]) expect(hasButton(el, label)).toBe(true);
  });

  test("offers only what the board lock leaves", async () => {
    const { el, core } = await mounted(helloWith({ positions: POSITIONS }, { ...HELLO.lock, board: true }));
    act(() => {
      core.selection.set([{ block: "f" }]);
    });
    for (const label of ["Layout", "Copy"]) expect(hasButton(el, label)).toBe(true);
    for (const label of ["Add to the board", "Paste", "Add the selection to a stack", "Cut", "Remove"]) expect(hasButton(el, label)).toBe(false);
  });

  test("pops out the board actions of its +, and triggers the one that the user picks", async () => {
    const { el, core, stub } = await mounted();
    await pointerPress(button(el, "Add to the board"));
    expect(menuItems(openMenu("Add to the board"))).toEqual(["Add block", "Create link", "Create stack"]);
    await pointerPress(menuItem(openMenu("Add to the board"), "Create stack"));
    // Create stack's quick action opens at the +, with the name of the stack.
    await vi.waitFor(() => {
      expect(stub.menu()?.level()?.rows.map((row) => row.label)).toEqual(["Name"]);
    });
    await act(async () => {
      await stub.menu()?.pick("Name");
    });
    expect(Object.keys(core.store.board().stacks)).toHaveLength(2);
  });

  test("opens what a button opens to the right of the toolbar, level with the toolbar's edge above the button", async () => {
    const { el, core } = await mounted();
    // The toolbar is 36 px wide at 10, 10, and holds the button 4 px in from
    // its edges, as happy-dom lays nothing out.
    const rects = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.classList.contains("blockr-graph-toolbar")) return new DOMRect(10, 10, 36, 300);
      if (this.getAttribute("aria-label") === "Layout") return new DOMRect(14, 200, 28, 28);
      return new DOMRect(0, 0, 0, 0);
    });
    const trigger = vi.spyOn(core.boardActions, "trigger");
    await pointerPress(button(el, "Layout"));
    // Core's menu hangs 4 px below its anchor, so its top lies at 196, 4 px
    // above the button's, as the toolbar's top lies 4 px above its first
    // button's, and 8 px to the right of the toolbar.
    const anchor = trigger.mock.calls[0]?.[2].anchor;
    expect([anchor?.x, anchor?.y]).toEqual([54, 192]);
    rects.mockRestore();
    trigger.mockRestore();
  });

  test("opens a board action's quick action, and runs one that asks nothing", async () => {
    const { el, core, stub } = await mounted();
    await pointerPress(button(el, "Layout"));
    expect(stub.menu()?.level()?.title).toBe("Layout");
    act(() => {
      core.selection.set([{ block: "f" }]);
    });
    await pointerPress(button(el, "Remove"));
    await vi.waitFor(() => {
      expect(names(core)).not.toContain("Scatter");
    });
  });
});

describe("the keys", () => {
  test("remove the selection on Backspace, but not while the user types in a field", async () => {
    const { el, core } = await mounted();
    act(() => {
      core.selection.set([{ block: "f" }]);
    });
    await pointerPress(button(el, "Search blocks"));
    const field = el.querySelector(".blockr-graph-search input");
    if (field === null) throw new Error("No search field");
    await keyDown(field, { key: "Backspace" });
    expect(names(core)).toContain("Scatter");
    await keyDown(frameOf(el), { key: "Backspace" });
    await vi.waitFor(() => {
      expect(names(core)).not.toContain("Scatter");
    });
  });

  test("copy the selection with Cmd or Ctrl and C, and paste it with V through the browser's paste, without reading the clipboard", async () => {
    const { el, core } = await mounted();
    act(() => {
      core.selection.set([{ block: "f" }]);
    });
    await keyDown(frameOf(el), { key: "c", metaKey: true });
    const copied = await navigator.clipboard.readText();
    expect(Object.keys((JSON.parse(copied) as JsonBoard).board.blocks)).toEqual(["f"]);
    // The DAG leaves V to the browser, whose paste hands the page the
    // clipboard, so that the DAG reads none, for which the browser would ask
    // the user.
    const read = vi.spyOn(navigator.clipboard, "readText");
    const v = new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true, cancelable: true });
    act(() => {
      frameOf(el).dispatchEvent(v);
    });
    expect(v.defaultPrevented).toBe(false);
    frameOf(el).focus();
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", copied);
    await act(async () => {
      document.body.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(names(core).filter((name) => name === "Scatter")).toHaveLength(2);
    });
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  test("give core no notifier, so that core raises the refusal of a key's batch, which a frontend shows as a toast", async () => {
    const { el, core } = await mounted();
    const trigger = vi.spyOn(core.boardActions, "trigger");
    act(() => {
      core.selection.set([{ block: "f" }]);
    });
    await keyDown(frameOf(el), { key: "Backspace" });
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0]?.[2]).not.toHaveProperty("notifier");
    trigger.mockRestore();
  });
});

describe("the panel of advanced actions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Gives the DAG's element 1200 by 800 pixels, the canvas above the panel
  // 500, its toolbar a column at its top left, and every other element a box
  // of 40 by 52 at 200, 470, as happy-dom lays nothing out.
  function room(): void {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.classList.contains("blockr-graph")) return new DOMRect(0, 0, 1200, 800);
      if (this.classList.contains("blockr-graph-stage")) return new DOMRect(0, 0, 1200, 500);
      if (this.classList.contains("blockr-graph-toolbar")) return new DOMRect(10, 10, 36, 300);
      return new DOMRect(200, 470, 40, 52);
    });
  }

  function panel(el: HTMLElement): HTMLElement | null {
    return el.querySelector<HTMLElement>(".blockr-graph-panel");
  }

  // Where the canvas's view lies, by the transform of React Flow's viewport.
  function viewport(el: HTMLElement): string {
    return el.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
  }

  // Opens the tester's advanced action from the menu of the canvas.
  async function probe(el: HTMLElement, stub: StubCore): Promise<void> {
    await rightClick(pane(el));
    // The pick resolves once the advanced action that it opens ends.
    act(() => {
      void stub.menu()?.pick("Probe");
    });
    await vi.waitFor(() => {
      expect(panel(el)).not.toBeNull();
    });
  }

  test("docks an advanced action below the canvas, and closes once it ends", async () => {
    const { el, core, stub } = await mountedWithTester();
    room();
    await probe(el, stub);
    expect(stub.advanced()).toBeUndefined();
    expect(panel(el)?.getAttribute("aria-label")).toBe("Probe");
    expect(panel(el)?.previousElementSibling?.classList.contains("blockr-graph-stage")).toBe(true);
    expect(panel(el)?.querySelector("p")?.textContent).toBe('{"board":true}');
    await click(panel(el)?.querySelector("button:not([aria-label])") ?? el);
    await vi.waitFor(() => {
      expect(panel(el)).toBeNull();
    });
    expect(names(core)).toContain("Renamed");
  });

  test("pans the canvas until the advanced action's object lies above the panel", async () => {
    const { el, stub } = await mountedWithTester();
    room();
    const before = viewport(el);
    const edge = el.querySelector('.react-flow__edge[data-id="l:ab"]');
    if (edge === null) throw new Error("No edge");
    await rightClick(edge);
    act(() => {
      void stub.menu()?.pick("Probe");
    });
    await vi.waitFor(() => {
      expect(panel(el)?.querySelector("p")?.textContent).toBe('{"link":"ab"}');
    });
    // The link's box reaches to 522 px, which the canvas of 500 px pans up
    // until it ends 10 px above the panel.
    const y = (transform: string) => Number(/translate\([^,]+,\s*(-?[\d.]+)px\)/.exec(transform)?.[1]);
    await vi.waitFor(() => {
      expect(y(viewport(el)) - y(before)).toBeCloseTo(-32);
    });
  });

  test("takes the focus as it opens, and closes on Escape on the canvas, unless it is pinned", async () => {
    const { el, stub } = await mountedWithTester();
    room();
    await probe(el, stub);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(panel(el));
    });
    await keyDown(frameOf(el), { key: "Escape" });
    expect(panel(el)).toBeNull();
    expect(document.activeElement).toBe(frameOf(el));
    await probe(el, stub);
    await pointerPress(button(el, "Pin"));
    await keyDown(frameOf(el), { key: "Escape" });
    expect(panel(el)).not.toBeNull();
  });

  test("leaves the advanced action to the frontend's place where the canvas has no room for it", async () => {
    const { el, stub } = await mountedWithTester();
    await rightClick(pane(el));
    act(() => {
      void stub.menu()?.pick("Probe");
    });
    await vi.waitFor(() => {
      expect(stub.advanced()).toBeDefined();
    });
    expect(panel(el)).toBeNull();
  });

  test("once pinned, mounts an advanced action drawn in React afresh on the block that the user selects", async () => {
    const { el, core, stub } = await mounted();
    room();
    await rightClick(nodeOf(el, "b:c"));
    act(() => {
      void stub.menu()?.pick("Edit inputs");
    });
    await vi.waitFor(() => {
      expect(panel(el)?.textContent).toContain('The inputs of the block "Merge".');
    });
    await pointerPress(button(el, "Pin"));
    await act(async () => {
      core.selection.set([{ block: "d" }]);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(panel(el)?.textContent).toContain('The inputs of the block "Wide sepals".');
    });
    expect(panel(el)?.querySelectorAll(".blockr-graph-panel-body")).toHaveLength(1);
  });

  test("once pinned, follows the selection and stays open once its advanced action ends", async () => {
    const { el, core, stub } = await mountedWithTester();
    room();
    const edge = el.querySelector('.react-flow__edge[data-id="l:ab"]');
    if (edge === null) throw new Error("No edge");
    await rightClick(edge);
    act(() => {
      void stub.menu()?.pick("Probe");
    });
    await vi.waitFor(() => {
      expect(panel(el)).not.toBeNull();
    });
    await pointerPress(button(el, "Pin"));
    act(() => {
      core.selection.set([{ link: "bc" }]);
    });
    expect(panel(el)?.querySelector("p")?.textContent).toBe('{"link":"bc"}');
    // A selection of several, or of an object that the board action is not
    // on, changes nothing.
    act(() => {
      core.selection.set([{ stack: "s1" }]);
    });
    expect(panel(el)?.querySelector("p")?.textContent).toBe('{"link":"bc"}');
    await click(panel(el)?.querySelector("button:not([aria-label])") ?? el);
    await vi.waitFor(() => {
      expect(names(core)).toContain("Renamed");
    });
    expect(panel(el)?.querySelector("p")?.textContent).toBe('{"link":"bc"}');
    await pointerPress(button(el, "Close"));
    expect(panel(el)).toBeNull();
  });
});
