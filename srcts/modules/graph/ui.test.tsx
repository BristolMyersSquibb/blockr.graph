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

// The DAG's UI mounted in an element of the page, as a frontend places it.
async function mounted(hello: HelloReply = helloWith({ positions: POSITIONS })): Promise<Mounted> {
  const stub = await act(() => stubCore({ hello, modules: { [GRAPH]: graph } }));
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

async function press(button: HTMLElement): Promise<void> {
  await act(async () => {
    button.click();
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
    expect(s1?.style.getPropertyValue("--blockr-graph-stack-color")).toBe("var(--bc-color-border-default)");
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
    await press(button(el, "Collapse Input"));
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
  function rows(el: HTMLElement): string[] {
    return [...el.querySelectorAll<HTMLElement>(".blockr-graph-search [role=row]")].map((row) => row.textContent.trim());
  }

  async function type(input: HTMLInputElement, text: string): Promise<void> {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  function field(el: HTMLElement): HTMLInputElement {
    const input = el.querySelector<HTMLInputElement>(".blockr-graph-search input");
    if (input === null) throw new Error("No search field");
    return input;
  }

  function row(el: HTMLElement, text: string): HTMLElement {
    const found = [...el.querySelectorAll<HTMLElement>(".blockr-graph-search [role=row]")].find((each) => each.textContent.trim() === text);
    if (found === undefined) throw new Error(`No row ${text}`);
    return found;
  }

  test("lists each stack with its blocks, and then the blocks in no stack, as the toolbar's button opens it", async () => {
    const { el } = await mounted();
    expect(el.querySelector(".blockr-graph-search")).toBeNull();
    await press(button(el, "Search blocks"));
    expect(el.querySelector(".blockr-graph-search-heading")?.textContent).toBe("Board contents");
    expect(rows(el)).toEqual(["Input (2)", "Iris", "Head", "Merge", "Wide sepals", "Bind", "Scatter"]);
  });

  test("narrows to the stacks and the blocks whose name or id holds what the user types", async () => {
    const { el } = await mounted();
    await press(button(el, "Search blocks"));
    await type(field(el), "in");
    expect(rows(el)).toEqual(["Input (2)", "Bind"]);
    await type(field(el), "zzz");
    expect(el.querySelector(".blockr-graph-search-none")?.textContent).toBe("No block or stack matches.");
  });

  test("selects and shows the block that the user picks, and closes", async () => {
    const { el, core } = await mounted();
    const show = vi.spyOn(core, "show");
    await press(button(el, "Search blocks"));
    await type(field(el), "merge");
    await click(row(el, "Merge"));
    await vi.waitFor(() => {
      expect(core.selection.get()).toEqual([{ block: "c" }]);
    });
    expect(show).toHaveBeenCalledWith({ block: "c" });
    expect(el.querySelector(".blockr-graph-search")).toBeNull();
  });

  test("expands the collapsed stack of the block that the user picks first", async () => {
    const collapsed = { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } } };
    const { el, core } = await mounted(helloWith({ positions: POSITIONS, stacks: collapsed }));
    await press(button(el, "Search blocks"));
    // The outline shows the stack folded, as the canvas does.
    expect(rows(el)).toEqual(["Input (2)", "Merge", "Wide sepals", "Bind", "Scatter"]);
    await type(field(el), "head");
    await click(row(el, "Head"));
    await vi.waitFor(() => {
      expect(core.selection.get()).toEqual([{ block: "b" }]);
    });
    expect((core.store.board().plugins[GRAPH] as GraphState).stacks.s1).toBeUndefined();
    expect(nodeIds(el)).toContain("b:b");
  });

  test("closes on Escape", async () => {
    const { el } = await mounted();
    await press(button(el, "Search blocks"));
    await act(async () => {
      el.querySelector(".blockr-graph-search")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await Promise.resolve();
    });
    expect(el.querySelector(".blockr-graph-search")).toBeNull();
  });
});
