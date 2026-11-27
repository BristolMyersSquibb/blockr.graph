// The nodes and the edges that the DAG gives React Flow, from the board and
// the DAG's state (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#nodes).

import type { BlockRegistry, Board, RegistryEntry } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { Position } from "../flow/index.ts";
import { BLOCK_HEIGHT, blockWidth, canvasOf, changed, expandedBox, MARK, STACK_HEIGHT, STACK_WIDTH } from "../geometry/index.ts";
import { shapePath, stackShape } from "../shape/index.ts";
import { defaultState, GRAPH } from "../state/index.ts";
import type { GraphState, Layout } from "../state/index.ts";
import { boardOf, withState } from "../testing/index.ts";
import { elementsOf, HANDLE, NEXT, sideTowards } from "./elements.ts";
import type { BlockNode, Drawing, GraphNode, HandleSpec, StackNode } from "./elements.ts";

// A registry entry of a class with the inputs given.
function entry(id: string, inputs: readonly string[], category = "transform"): RegistryEntry {
  return {
    id,
    name: id,
    description: "",
    keywords: [],
    category,
    icon: "<svg></svg>",
    inputs,
    module: "",
    version: 1,
    schema: {},
    block_name: id,
    state: {},
    requests: {},
  };
}

const REGISTRY: BlockRegistry = {
  "blockr.core-head_block": entry("blockr.core-head_block", ["data"]),
  "blockr.core-merge_block": entry("blockr.core-merge_block", ["x", "y"]),
  "blockr.core-rbind_block": entry("blockr.core-rbind_block", ["..."]),
  "blockr.core-dataset_block": entry("blockr.core-dataset_block", [], "input"),
};

function drawn(board: Board, more: Partial<Drawing> = {}) {
  const state = board.plugins[GRAPH] as GraphState;
  return elementsOf({
    canvas: canvasOf(board, state),
    registry: REGISTRY,
    layout: state.layout,
    selected: new Set(),
    hovered: null,
    locked: false,
    spread: null,
    ...more,
  });
}

function node(nodes: readonly GraphNode[], id: string): GraphNode {
  const found = nodes.find((each) => each.id === id);
  if (found === undefined) throw new Error(`No node ${id}`);
  return found;
}

function blockNode(nodes: readonly GraphNode[], id: string): BlockNode {
  const found = node(nodes, `b:${id}`);
  if (found.type !== "block") throw new Error(`The node b:${id} is no block`);
  return found;
}

function stackNode(nodes: readonly GraphNode[], id: string): StackNode {
  const found = node(nodes, `s:${id}`);
  if (found.type !== "stack") throw new Error(`The node s:${id} is no stack`);
  return found;
}

function handle(found: BlockNode | StackNode, id: string): HandleSpec {
  const spec = found.data.handles.find((each) => each.id === id);
  if (spec === undefined) throw new Error(`No handle ${id} on ${found.id}`);
  return spec;
}

// The middle of a handle, relative to the node's top left corner.
function middle(spec: HandleSpec): { x: number; y: number } {
  return { x: spec.x + HANDLE / 2, y: spec.y + HANDLE / 2 };
}

// A board whose blocks have classes and names, with links that feed inputs.
function classed(
  blocks: Readonly<Record<string, string>>,
  links: Readonly<Record<string, { from: string; to: string; input: string }>>,
  positions: GraphState["positions"],
  layout: Partial<Layout> = {},
): Board {
  return {
    id: "test",
    name: "Test",
    blocks: Object.fromEntries(Object.entries(blocks).map(([id, cls]) => [id, { registry_id: cls, state: {}, name: id.toUpperCase(), locked: null }])),
    links,
    stacks: {},
    options: {},
    plugins: { [GRAPH]: { ...defaultState, positions, layout: { ...defaultState.layout, ...layout } } },
  };
}

describe("a block's node", () => {
  test("is centred at the block's position, with the nominal size of its mark and its name", () => {
    const board = boardOf({ blocks: { a: "Dataset" }, state: { positions: { a: { x: 100, y: 50 } } } });
    const a = blockNode(drawn(board).nodes, "a");
    expect(a.position).toEqual({ x: 100, y: 50 });
    expect([a.width, a.height]).toEqual([blockWidth("Dataset"), BLOCK_HEIGHT]);
    expect(a.measured).toEqual({ width: blockWidth("Dataset"), height: BLOCK_HEIGHT });
    expect(a.data).toMatchObject({ kind: "block", block: "a", name: "Dataset" });
    expect(a.parentId).toBeUndefined();
  });

  test("is none for a block without a position", () => {
    const board = boardOf({ blocks: { a: "A", b: "B" }, links: [["a", "b"]], state: { positions: { a: { x: 0, y: 0 } } } });
    const { nodes, edges } = drawn(board);
    expect(nodes.map((each) => each.id)).toEqual(["b:a"]);
    expect(edges).toEqual([]);
  });

  test("of a block in a stack sits in the stack's box, relative to the box's top left corner", () => {
    const board = boardOf({
      blocks: { a: "A", b: "B" },
      stacks: { s1: ["a", "b"] },
      state: { positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 150 } } },
    });
    const { nodes } = drawn(board);
    const box = expandedBox(canvasOf(board, board.plugins[GRAPH] as GraphState), "s1");
    if (box === undefined) throw new Error("No box");
    const s1 = stackNode(nodes, "s1");
    const [w, h] = [Math.ceil(box.w), Math.ceil(box.h)];
    expect(s1.position).toEqual({ x: box.x, y: box.y });
    expect([s1.width, s1.height]).toEqual([w, h]);
    expect(s1.data.shows).toBe("expanded");
    const b = blockNode(nodes, "b");
    expect(b.parentId).toBe("s:s1");
    expect(b.position).toEqual({ x: 0 - (box.x - w / 2), y: 150 - (box.y - h / 2) });
  });

  test("draws the selection that the DAG holds", () => {
    const board = boardOf({ blocks: { a: "A", b: "B" }, state: { positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 150 } } } });
    const { nodes } = drawn(board, { selected: new Set(["b:b"]) });
    expect(nodes.map((each) => [each.id, each.selected])).toEqual([
      ["b:a", false],
      ["b:b", true],
    ]);
  });
});

describe("a handle", () => {
  const below = (x: number, y: number) => classed({ a: "blockr.core-dataset_block", b: "blockr.core-head_block" }, { ab: { from: "a", to: "b", input: "data" } }, { a: { x: 0, y: 0 }, b: { x, y } });

  test("sits on the side of the mark that faces the block at the other end of its link", () => {
    const { nodes, edges } = drawn(below(0, 150));
    expect(blockNode(nodes, "a").data.handles.map((each) => [each.id, each.side])).toEqual([["out-bottom", "bottom"]]);
    expect(blockNode(nodes, "b").data.handles.map((each) => [each.id, each.side])).toEqual([
      ["in:data#ab", "top"],
      ["out-bottom", "bottom"],
    ]);
    expect(edges).toMatchObject([{ id: "l:ab", source: "b:a", target: "b:b", sourceHandle: "out-bottom", targetHandle: "in:data#ab" }]);
  });

  test("moves to the sides that face each other as a block moves", () => {
    // Block b, which reads from a, sits above a now, and then to its left.
    expect(drawn(below(0, -150)).edges[0]).toMatchObject({ sourceHandle: "out-top" });
    expect(handle(blockNode(drawn(below(0, -150)).nodes, "b"), "in:data#ab").side).toBe("bottom");
    expect(drawn(below(-200, 20)).edges[0]).toMatchObject({ sourceHandle: "out-left" });
    expect(handle(blockNode(drawn(below(-200, 20)).nodes, "b"), "in:data#ab").side).toBe("right");
  });

  test("that no link uses sits on the side that the layout's direction gives", () => {
    const lone = (direction: Layout["direction"]) =>
      blockNode(drawn(classed({ a: "blockr.core-head_block" }, {}, { a: { x: 0, y: 0 } }, { direction })).nodes, "a").data.handles;
    expect(lone("TB").map((each) => [each.id, each.side])).toEqual([
      ["in:data", "top"],
      ["out-bottom", "bottom"],
    ]);
    expect(lone("LR").map((each) => [each.id, each.side])).toEqual([
      ["out-right", "right"],
      ["in:data", "left"],
    ]);
  });

  test("of a result shows on each side that one of its links uses", () => {
    const board = classed(
      { a: "blockr.core-dataset_block", b: "blockr.core-head_block", c: "blockr.core-head_block" },
      { ab: { from: "a", to: "b", input: "data" }, ac: { from: "a", to: "c", input: "data" } },
      { a: { x: 0, y: 0 }, b: { x: 0, y: 150 }, c: { x: 250, y: 0 } },
    );
    const { nodes, edges } = drawn(board);
    expect(blockNode(nodes, "a").data.handles.map((each) => each.id)).toEqual(["out-right", "out-bottom"]);
    expect(edges.map((each) => [each.id, each.sourceHandle])).toEqual([
      ["l:ab", "out-bottom"],
      ["l:ac", "out-right"],
    ]);
  });

  test("sits on the mark's edges, and below the name on the bottom", () => {
    const { nodes } = drawn(below(0, 150));
    const b = blockNode(nodes, "b");
    expect(middle(handle(b, "in:data#ab"))).toEqual({ x: (b.width ?? 0) / 2, y: 0 });
    expect(middle(handle(b, "out-bottom"))).toEqual({ x: (b.width ?? 0) / 2, y: BLOCK_HEIGHT });
    const lr = blockNode(drawn(classed({ a: "blockr.core-head_block" }, {}, { a: { x: 0, y: 0 } }, { direction: "LR" })).nodes, "a");
    const lrLeft = ((lr.width ?? 0) - MARK) / 2;
    expect(middle(handle(lr, "in:data"))).toEqual({ x: lrLeft, y: MARK / 2 });
    expect(middle(handle(lr, "out-right"))).toEqual({ x: lrLeft + MARK, y: MARK / 2 });
  });

  test("gives React Flow where it sits, with the side and the size", () => {
    const { nodes } = drawn(below(0, 150));
    const b = blockNode(nodes, "b");
    expect(b.handles).toEqual(
      b.data.handles.map((each) => ({ id: each.id, type: each.type, position: each.side, x: each.x, y: each.y, width: HANDLE, height: HANDLE })),
    );
  });

  test("names its input, with the block that the link that feeds it comes from", () => {
    const board = classed(
      { a: "blockr.core-dataset_block", b: "blockr.core-dataset_block", c: "blockr.core-merge_block" },
      { ac: { from: "a", to: "c", input: "x" } },
      { a: { x: -100, y: 0 }, b: { x: 100, y: 0 }, c: { x: 0, y: 150 } },
    );
    const c = blockNode(drawn(board).nodes, "c");
    expect(c.data.handles.filter((each) => each.type === "target").map((each) => [each.id, each.name, each.label, each.input])).toEqual([
      ["in:x#ac", "x", "x, from A", "x"],
      ["in:y", "y", "y", "y"],
    ]);
  });

  test("on one side spreads along it, at least 12 px apart, in the order of the class's inputs", () => {
    const board = classed(
      { a: "blockr.core-dataset_block", b: "blockr.core-dataset_block", c: "blockr.core-merge_block" },
      { ac: { from: "a", to: "c", input: "x" }, bc: { from: "b", to: "c", input: "y" } },
      { a: { x: -100, y: 0 }, b: { x: 100, y: 0 }, c: { x: 0, y: 150 } },
    );
    const c = blockNode(drawn(board).nodes, "c");
    const [x, y] = [handle(c, "in:x#ac"), handle(c, "in:y#bc")];
    expect(x.side).toBe("top");
    expect(y.side).toBe("top");
    expect(middle(y).x - middle(x).x).toBeGreaterThanOrEqual(12);
    expect(middle(x).x).toBeLessThan(middle(y).x);
  });

  // A variadic block t, with links from blocks above it, or to its right,
  // and its result feeding a block to its right.
  const variadic = (links: number, from: "above" | "right") => {
    const blocks: Record<string, string> = { t: "blockr.core-rbind_block", z: "blockr.core-head_block" };
    const all: Record<string, { from: string; to: string; input: string }> = { tz: { from: "t", to: "z", input: "data" } };
    const positions: Record<string, { x: number; y: number }> = { t: { x: 0, y: 0 }, z: { x: 300, y: 20 } };
    for (let i = 0; i < links; i += 1) {
      blocks[`s${String(i)}`] = "blockr.core-dataset_block";
      positions[`s${String(i)}`] = from === "above" ? { x: -200 + 40 * i, y: -200 } : { x: 250, y: -40 + 10 * i };
      all[`l${String(i)}`] = { from: `s${String(i)}`, to: "t", input: "" };
    }
    return classed(blocks, all, positions);
  };

  // The middles of a side's handles, along the side, relative to the mark's
  // left or top edge.
  const along = (node: BlockNode, side: string) => {
    const left = ((node.width ?? 0) - MARK) / 2;
    return node.data.handles
      .filter((each) => each.side === side)
      .map((each) => (side === "top" || side === "bottom" ? middle(each).x - left : middle(each).y));
  };

  test("sit 12 px apart on the mark's side where they fit there, and crowd it where they do not", () => {
    // Two links and the placeholder of the next place fit on top.
    const three = blockNode(drawn(variadic(2, "above")).nodes, "t");
    expect(along(three, "top")).toEqual([4, 16, 28]);
    expect(three.data.handles.filter((each) => each.side === "top").every((each) => !each.crowded)).toBe(true);
    // Four links and the placeholder crowd the top, 6 px apart, and eight
    // links and the placeholder 3 px apart, from one end of the mark to the
    // other.
    const five = blockNode(drawn(variadic(4, "above")).nodes, "t");
    expect(along(five, "top")).toEqual([4, 10, 16, 22, 28]);
    expect(five.data.handles.filter((each) => each.side === "top").every((each) => each.crowded)).toBe(true);
    expect(along(blockNode(drawn(variadic(8, "above")).nodes, "t"), "top")).toEqual([4, 7, 10, 13, 16, 19, 22, 25, 28]);
  });

  test("of a crowded side spread out 12 px apart as the drawing names the side, around the mark's middle", () => {
    const board = variadic(4, "above");
    const spread = blockNode(drawn(board, { spread: { node: "b:t", side: "top" } }).nodes, "t");
    expect(along(spread, "top")).toEqual([-8, 4, 16, 28, 40]);
    // A side that fits on the mark sits as it does, whichever side spreads.
    const fits = blockNode(drawn(variadic(2, "above"), { spread: { node: "b:t", side: "top" } }).nodes, "t");
    expect(along(fits, "top")).toEqual([4, 16, 28]);
    // The spread side's handles give React Flow where they sit, so that the
    // links follow them.
    expect(spread.handles?.filter((each) => each.position === Position.Top).map((each) => each.x + HANDLE / 2 - ((spread.width ?? 0) - MARK) / 2)).toEqual([
      -8, 4, 16, 28, 40,
    ]);
  });

  test("on the right side stay above the status dot on the mark's lower right corner, crowded or spread", () => {
    const board = variadic(3, "right");
    const crowded = blockNode(drawn(board).nodes, "t");
    const right = along(crowded, "right");
    expect(right).toHaveLength(4);
    expect(Math.min(...right)).toBe(4);
    expect(Math.max(...right)).toBe(MARK - 14);
    const spread = along(blockNode(drawn(board, { spread: { node: "b:t", side: "right" } }).nodes, "t"), "right");
    expect(spread.slice(1).map((at, i) => at - (spread[i] ?? 0))).toEqual([12, 12, 12]);
    expect(Math.max(...spread)).toBe(MARK - 14);
  });

  test("keeps clear of the status dot on the mark's lower right corner, even while it grows under the pointer", () => {
    // The dot, as the stylesheet draws it: 8 px across, 2 px out of the
    // mark's lower right corner, with a ring of 2 px, relative to the mark's
    // top left corner. A handle reaches 6 px from its middle while it grows
    // to 1.5 times its size.
    const dot = { left: MARK - 8, right: MARK + 4, top: MARK - 8, bottom: MARK + 4 };
    const grown = (HANDLE * 1.5) / 2;
    const boards = [variadic(2, "above"), variadic(4, "above"), variadic(1, "right"), variadic(3, "right"), variadic(8, "right")];
    const sides = ["top", "right", "bottom", "left"] as const;
    for (const board of boards) {
      for (const spread of [null, ...sides.map((side) => ({ node: "b:t", side }))]) {
        const t = blockNode(drawn(board, { spread }).nodes, "t");
        const left = ((t.width ?? 0) - MARK) / 2;
        for (const spec of t.data.handles) {
          const { x, y } = middle(spec);
          const apart = Math.max(dot.left - (x - left + grown), x - left - grown - dot.right, dot.top - (y + grown), y - grown - dot.bottom);
          expect(apart, `${spec.id} on ${spec.side}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test("on a side alone sits in the middle of the side", () => {
    const board = classed({ a: "blockr.core-dataset_block", b: "blockr.core-head_block" }, { ab: { from: "a", to: "b", input: "data" } }, {
      a: { x: 200, y: 0 },
      b: { x: 0, y: 0 },
    });
    const b = blockNode(drawn(board).nodes, "b");
    expect(middle(handle(b, "in:data#ab"))).toEqual({ x: ((b.width ?? 0) + MARK) / 2, y: MARK / 2 });
  });

  test("of a variadic block is one for each link into it, in their order, and a placeholder for its next place", () => {
    const board = classed(
      { a: "blockr.core-dataset_block", b: "blockr.core-dataset_block", e: "blockr.core-rbind_block" },
      { be: { from: "b", to: "e", input: "b2" }, ae: { from: "a", to: "e", input: "" } },
      { a: { x: -50, y: 0 }, b: { x: 50, y: 0 }, e: { x: 0, y: 150 } },
    );
    const { nodes, edges } = drawn(board);
    const e = blockNode(nodes, "e");
    expect(e.data.handles.filter((each) => each.type === "target").map((each) => [each.id, each.label, each.input, each.link])).toEqual([
      ["in:b2#be", "b2, from B", undefined, "be"],
      ["in:#ae", "Input 2, from A", undefined, "ae"],
      [NEXT, "Next input", "", undefined],
    ]);
    expect(edges.map((each) => [each.id, each.targetHandle, each.data?.label])).toEqual([
      ["l:be", "in:b2#be", "b2"],
      ["l:ae", "in:#ae", "Input 2"],
    ]);
  });

  test("takes no link under the board lock", () => {
    const { nodes } = drawn(below(0, 150), { locked: true });
    expect(blockNode(nodes, "b").data.handles.every((each) => !each.connectable)).toBe(true);
  });

  test("of an input that a link feeds is there where the block registry lacks the class", () => {
    const board = classed({ a: "blockr.core-dataset_block", b: "blockr.test-gone_block" }, { ab: { from: "a", to: "b", input: "data" } }, {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 150 },
    });
    const b = blockNode(drawn(board).nodes, "b");
    expect(b.data.entry).toBeUndefined();
    expect(b.data.handles.map((each) => each.id)).toEqual(["in:data#ab", "out-bottom"]);
  });
});

describe("a link", () => {
  test("shows the name of the input that it feeds, and how it shows while the pointer is over the handle of that input", () => {
    const board = boardOf({ blocks: { a: "A", b: "B" }, links: [["a", "b"]], state: { positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 150 } } } });
    expect(drawn(board).edges[0]).toMatchObject({ type: "link", data: { link: "l1", label: "data" } });
    expect(drawn(board).edges[0]?.className).toBeUndefined();
    expect(drawn(board, { hovered: "l1" }).edges[0]?.className).toBe("blockr-graph-hovered");
    expect(drawn(board, { selected: new Set(["l:l1"]) }).edges[0]?.selected).toBe(true);
  });
});

describe("a stack", () => {
  const stacked = (state: Partial<GraphState>) =>
    boardOf({
      blocks: { a: "A", b: "B", c: "C", d: "D" },
      links: [
        ["a", "b"],
        ["b", "c"],
        ["d", "b"],
      ],
      stacks: { s1: ["a", "b"] },
      state: { positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 150 }, c: { x: 0, y: 300 }, d: { x: 300, y: 150 } }, ...state },
    });

  test("that the DAG shows collapsed is a box of its own size, centred where its expanded box is, and its blocks hide", () => {
    const expanded = stacked({});
    const collapsed = withState(expanded, { stacks: { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } } } });
    const box = expandedBox(canvasOf(expanded, expanded.plugins[GRAPH] as GraphState), "s1");
    const { nodes } = drawn(collapsed);
    const s1 = stackNode(nodes, "s1");
    expect(s1.position).toEqual({ x: box?.x, y: box?.y });
    expect([s1.width, s1.height]).toEqual([STACK_WIDTH, STACK_HEIGHT]);
    expect(s1.data).toMatchObject({ shows: "collapsed", count: 2, name: "s1", color: null });
    expect(nodes.map((each) => each.id).sort()).toEqual(["b:c", "b:d", "s:s1"]);
  });

  test("that is collapsed ends the links between its blocks and blocks outside it on its box, and hides those between its blocks", () => {
    const collapsed = withState(stacked({}), { stacks: { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } } } });
    const { nodes, edges } = drawn(collapsed);
    expect(edges.map((each) => [each.id, each.source, each.sourceHandle, each.target, each.targetHandle])).toEqual([
      ["l:l2", "s:s1", "out-bottom", "b:c", "in:data#l2"],
      ["l:l3", "b:d", "out-left", "s:s1", "in-right"],
    ]);
    const s1 = stackNode(nodes, "s1");
    expect(s1.data.handles.map((each) => [each.id, each.side, each.connectable])).toEqual([
      ["in-right", "right", false],
      ["out-bottom", "bottom", false],
    ]);
  });

  test("that holds no block is a box at its position, with its name and no block", () => {
    const board = { ...stacked({ stacks: { s2: { x: 500, y: 0 } } }) };
    const empty = { ...board, stacks: { ...board.stacks, s2: { name: "Empty", blocks: [], color: "#66c2a5" } } };
    const s2 = stackNode(drawn(empty).nodes, "s2");
    expect(s2.position).toEqual({ x: 500, y: 0 });
    expect([s2.width, s2.height]).toEqual([STACK_WIDTH, STACK_HEIGHT]);
    expect(s2.data).toMatchObject({ shows: "empty", count: 0, name: "Empty", color: "#66c2a5", handles: [] });
  });

  test("that the DAG shows expanded draws its shape in its box, which alone takes the pointer, with its name above its topmost block", () => {
    const board = stacked({});
    const canvas = canvasOf(board, board.plugins[GRAPH] as GraphState);
    const s1 = stackNode(drawn(board).nodes, "s1");
    const box = expandedBox(canvas, "s1");
    const shape = stackShape(canvas, "s1");
    if (box === undefined || shape === undefined) throw new Error("No shape");
    expect(s1.data.shape).toBe(shapePath(shape, { x: box.x - box.w / 2, y: box.y - box.h / 2 }));
    expect(s1.data.shape).toMatch(/^M.+Z$/);
    expect(s1.data.nameAt).toBe(0);
    expect(s1.style).toEqual({ pointerEvents: "none" });
  });

  test("starts its name where the padding around its topmost block starts", () => {
    const board = boardOf({
      blocks: { p: "P", q: "Q" },
      stacks: { s: ["q", "p"] },
      state: { positions: { p: { x: 200, y: 0 }, q: { x: 0, y: 200 } } },
    });
    // Block p's padding starts 200 - 16 - 20 = 164 px from the middle of q,
    // whose padding starts the box at -36.
    expect(stackNode(drawn(board).nodes, "s").data.nameAt).toBe(200);
  });

  test("that is collapsed, or holds no block, draws no shape, and takes the pointer on all its box", () => {
    const collapsed = withState(stacked({}), { stacks: { s1: { collapsed: 1, moved: { positions: {}, stacks: {} } } } });
    const s1 = stackNode(drawn(collapsed).nodes, "s1");
    expect(s1.data.shape).toBe("");
    expect(s1.style).toBeUndefined();
  });

  test("draws its shape clear of the nodes around it, but for those that a drag moves", () => {
    const board = stacked({});
    const state = board.plugins[GRAPH] as GraphState;
    const canvas = canvasOf(board, state);
    const dragging = { positions: { d: { x: 300, y: 150 } }, points: {} };
    const { nodes } = elementsOf({ canvas, registry: REGISTRY, layout: state.layout, selected: new Set(), hovered: null, locked: false, spread: null, dragging });
    const box = expandedBox(canvas, "s1");
    const shape = stackShape(canvas, "s1", dragging);
    if (box === undefined || shape === undefined) throw new Error("No shape");
    expect(stackNode(nodes, "s1").data.shape).toBe(shapePath(shape, { x: box.x - box.w / 2, y: box.y - box.h / 2 }));
  });

  test("draws its box around the moves that the DAG keeps while the user drags", () => {
    const board = stacked({});
    const state = board.plugins[GRAPH] as GraphState;
    const moved = changed(canvasOf(board, state), { positions: { b: { x: -200, y: 150 } }, points: {} });
    const { nodes } = elementsOf({ canvas: moved, registry: REGISTRY, layout: state.layout, selected: new Set(), hovered: null, locked: false, spread: null });
    const box = expandedBox(moved, "s1");
    expect(stackNode(nodes, "s1").position).toEqual({ x: box?.x, y: box?.y });
  });
});

describe("the side that faces another node", () => {
  test("is left or right where the nodes sit further apart across than along, and top or bottom otherwise", () => {
    expect(sideTowards({ x: 0, y: 0 }, { x: 10, y: 100 })).toBe("bottom");
    expect(sideTowards({ x: 0, y: 0 }, { x: 10, y: -100 })).toBe("top");
    expect(sideTowards({ x: 0, y: 0 }, { x: 100, y: 10 })).toBe("right");
    expect(sideTowards({ x: 0, y: 0 }, { x: -100, y: -10 })).toBe("left");
  });
});
