// The nodes and the edges that React Flow draws, made from the board, the
// DAG's state and what the user is doing on the canvas, on every change
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-canvas).
// It reads nothing on the page.
//
// - A block is a node centred at its position, whose box holds its mark and
//   its name below it, of the nominal size from which the DAG places blocks
//   (../geometry). A block without a position gets no node.
// - A stack is a group node behind its blocks: its box fits its blocks, and
//   each of its blocks gives React Flow its position relative to the box's
//   top left corner, as React Flow takes the position of a node with a
//   parentId. A collapsed stack, and a stack that holds no block, is a node
//   of the box that holds its name and the number of its blocks, and the
//   blocks of a collapsed stack get no node.
// - A link is an edge from the result of the block that it comes from into
//   the handle of the input that it feeds, or into its own handle on a
//   variadic block. A link between a block of a collapsed stack and a block
//   outside it ends on the stack's box, and one between two blocks of a
//   collapsed stack hides with them.
// - Each handle sits on the side of the mark that faces the node at the other
//   end of its link, so that a link leaves and enters the marks on the sides
//   that face each other. A result with several links shows on each side that
//   one of them uses. A handle that no link uses sits on the side that the
//   layout's direction gives. Several handles on one side spread along it,
//   the inputs in the order of the class's inputs, those of a variadic block
//   in the order of their links with the placeholder of its next place last,
//   and then the result.
//   A handle on the bottom sits below the block's name. Handles on top of the
//   mark stay left of the status dot on its upper right corner, and handles
//   on its right side stay below the dot.
// - Each node gives React Flow its handles, with where each sits, so that
//   React Flow measures none of them, and an edge ends where its handle sits
//   on the first frame.

import type { BlockId, BlockRegistry, Board, LinkId, RegistryEntry, StackId } from "@blockr/core";
import { Position } from "../flow/index.ts";
import type { Edge, Node, NodeHandle } from "../flow/index.ts";
import { BLOCK_HEIGHT, blockWidth, MARK, shownBox, stackOf } from "../geometry/index.ts";
import type { Box, Canvas } from "../geometry/index.ts";
import type { Layout, Point } from "../state/index.ts";
import { blockNode, linkEdge, stackNode } from "./ids.ts";

export type Side = "top" | "right" | "bottom" | "left";

// The width and the height of a handle.
export const HANDLE = 8;

// The least distance between the middles of two handles on one side.
const HANDLE_STEP = 12;

// How far the status dot reaches into the mark from the mark's upper right
// corner, along the top and along the right side: the dot is 8 px across and
// sits 2 px out of the corner, with a ring of 2 px around it.
const DOT_REACH = 8;

// How far a handle reaches from its middle while the pointer is over it, as
// the DAG's stylesheet grows it to 1.5 times its size.
const GROWN = (HANDLE * 1.5) / 2;

// How far from the mark's upper right corner the middle of a handle stays,
// along the top and along the right side, so that no handle touches the
// status dot, even while the pointer is over it.
const DOT_ROOM = DOT_REACH + GROWN;

// The id of the placeholder handle of a variadic block's next place.
export const NEXT = "next";

// The input that a class whose inputs are these names takes any number of
// links into, as R names the dots.
const DOTS = "...";

// A handle of a node.
export interface HandleSpec {
  readonly id: string;
  readonly type: "source" | "target";
  readonly side: Side;
  // Where the handle's box starts, relative to the node's top left corner.
  readonly x: number;
  readonly y: number;
  // What the handle is: its input's name, as "data", the place of a link into
  // a variadic block that has no name, as "Input 2", "Next input" for the
  // placeholder of a variadic block's next place, or "Result".
  readonly name: string;
  // What its tooltip says: its name, with the block that the link that feeds
  // it comes from, as "data, from Filter".
  readonly label: string;
  // The link that feeds the input, where one does.
  readonly link?: LinkId;
  // The input that a link dropped on it feeds: an input's name, or "" for the
  // next place of a variadic block. Undefined for a handle that takes no new
  // link, as a result does, or a place that a link holds.
  readonly input?: string;
  // Whether a link may start or end at it.
  readonly connectable: boolean;
}

export interface BlockData extends Record<string, unknown> {
  readonly kind: "block";
  readonly block: BlockId;
  readonly name: string;
  // The class's entry in the block registry, or undefined where the registry
  // lacks it.
  readonly entry: RegistryEntry | undefined;
  readonly handles: readonly HandleSpec[];
}

export interface StackData extends Record<string, unknown> {
  readonly kind: "stack";
  readonly stack: StackId;
  readonly name: string;
  // The colour that core keeps on the stack, or null for none.
  readonly color: string | null;
  // The number of its blocks.
  readonly count: number;
  // Whether it shows as a box around its blocks, as a collapsed stack, or as
  // a stack that holds no block.
  readonly shows: "expanded" | "collapsed" | "empty";
  readonly handles: readonly HandleSpec[];
}

export interface LinkData extends Record<string, unknown> {
  readonly link: LinkId;
  // The name of the input that the link feeds, which shows on the edge while
  // the pointer is over it.
  readonly label: string;
}

export type BlockNode = Node<BlockData, "block">;
export type StackNode = Node<StackData, "stack">;
export type GraphNode = BlockNode | StackNode;
export type GraphEdge = Edge<LinkData, "link">;

export interface Elements {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
}

export interface Drawing {
  // The board with where its blocks and stacks sit, with the moves of a drag
  // or of the arrow keys that the DAG has not run as a command yet.
  readonly canvas: Canvas;
  readonly registry: BlockRegistry;
  readonly layout: Layout;
  // The nodes and the edges that are selected, by their ids (./ids.ts).
  readonly selected: ReadonlySet<string>;
  // The link whose edge shows as it does while the pointer is over it, as
  // while the pointer is over the handle of the input that it feeds.
  readonly hovered: LinkId | null;
  // Whether the board lock is on, under which no link starts at a handle.
  readonly locked: boolean;
}

// Where a block shows: in its own node, centred at its position, or in the
// box of its collapsed stack.
interface Shown {
  readonly node: string;
  readonly centre: Point;
}

// A link that the DAG draws, with the sides on which it leaves and enters
// its nodes.
interface DrawnLink {
  readonly id: LinkId;
  readonly from: Shown;
  readonly to: Shown;
  readonly out: Side;
  readonly in: Side;
}

export function elementsOf(drawing: Drawing): Elements {
  const { canvas, registry, layout, selected, hovered, locked } = drawing;
  const { board } = canvas;
  const held = stackOf(board);
  const boxes = new Map<StackId, Box>();
  for (const stack of Object.keys(board.stacks)) {
    const box = shownBox(canvas, stack);
    if (box !== undefined) boxes.set(stack, whole(box));
  }

  const shown = (block: BlockId): Shown | undefined => {
    const point = canvas.positions[block];
    if (point === undefined || board.blocks[block] === undefined) return undefined;
    const stack = held.get(block);
    if (stack === undefined || !canvas.collapsed.has(stack)) return { node: blockNode(block), centre: point };
    const box = boxes.get(stack);
    return box === undefined ? undefined : { node: stackNode(stack), centre: { x: box.x, y: box.y } };
  };

  const links: DrawnLink[] = [];
  for (const [id, link] of Object.entries(board.links)) {
    const from = shown(link.from);
    const to = shown(link.to);
    if (from === undefined || to === undefined || from.node === to.node) continue;
    links.push({ id, from, to, out: sideTowards(from.centre, to.centre), in: sideTowards(to.centre, from.centre) });
  }
  const byId = new Map(links.map((link) => [link.id, link]));

  // The stacks come after the blocks, so that the first Tab from the canvas
  // reaches a block. React Flow 13 draws a stack's box behind its blocks in
  // any order.
  const stackNodes: GraphNode[] = [];
  for (const [id, stack] of Object.entries(board.stacks)) {
    const box = boxes.get(id);
    if (box === undefined) continue;
    const shows = stack.blocks.length === 0 ? "empty" : canvas.collapsed.has(id) ? "collapsed" : "expanded";
    const handles = shows === "collapsed" ? stackHandles(box, links, stackNode(id)) : [];
    stackNodes.push({
      id: stackNode(id),
      type: "stack",
      position: { x: box.x, y: box.y },
      width: box.w,
      height: box.h,
      measured: { width: box.w, height: box.h },
      handles: handles.map(nodeHandle),
      selected: selected.has(stackNode(id)),
      data: { kind: "stack", stack: id, name: stack.name, color: stack.color, count: stack.blocks.length, shows, handles },
    });
  }

  const nodes: GraphNode[] = [];
  for (const [id, block] of Object.entries(board.blocks)) {
    const point = canvas.positions[id];
    const stack = held.get(id);
    if (point === undefined || (stack !== undefined && canvas.collapsed.has(stack))) continue;
    const entry = registry[block.registry_id];
    const width = blockWidth(block.name);
    const handles = blockHandles({ board, id, entry, width, layout, links, byId, locked });
    const parent = stack === undefined ? undefined : boxes.get(stack);
    nodes.push({
      id: blockNode(id),
      type: "block",
      position: parent === undefined ? point : { x: point.x - (parent.x - parent.w / 2), y: point.y - (parent.y - parent.h / 2) },
      ...(parent === undefined || stack === undefined ? {} : { parentId: stackNode(stack) }),
      width,
      height: BLOCK_HEIGHT,
      measured: { width, height: BLOCK_HEIGHT },
      handles: handles.map(nodeHandle),
      selected: selected.has(blockNode(id)),
      data: { kind: "block", block: id, name: block.name, entry, handles },
    });
  }

  nodes.push(...stackNodes);

  const edges: GraphEdge[] = links.map((link) => {
    const { input } = board.links[link.id] ?? { input: "" };
    const target = link.to.node.startsWith("b:") ? inputHandle(board, link.id) : `in-${link.in}`;
    return {
      id: linkEdge(link.id),
      type: "link",
      source: link.from.node,
      target: link.to.node,
      sourceHandle: `out-${link.out}`,
      targetHandle: target,
      selected: selected.has(linkEdge(link.id)),
      ...(hovered === link.id ? { className: "blockr-graph-hovered" } : {}),
      data: { link: link.id, label: input === "" ? placeLabel(board, link.id) : input },
    };
  });

  return { nodes, edges };
}

// The box with its width and its height rounded up to whole pixels, around
// the same centre. React Flow measures a node's element in whole pixels, and
// places the blocks of a stack from the top left corner of the stack's box as
// it measures it, so the DAG draws the box at that size.
function whole(box: Box): Box {
  return { ...box, w: Math.ceil(box.w), h: Math.ceil(box.h) };
}

// The side of a node centred at `from` that faces a node centred at `to`:
// left or right where they sit further apart across than along, and top or
// bottom otherwise.
export function sideTowards(from: Point, to: Point): Side {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

// The side of an input, and of a result, that no link uses: from top to
// bottom, an input on top of the mark and the result below it, and from left
// to right, an input on the mark's left and the result on its right.
function idleSide(layout: Layout, type: "source" | "target"): Side {
  if (layout.direction === "TB") return type === "target" ? "top" : "bottom";
  return type === "target" ? "left" : "right";
}

// Whether a class takes any number of links into its one input.
export function isVariadic(entry: RegistryEntry | undefined): boolean {
  return entry?.inputs.length === 1 && entry.inputs[0] === DOTS;
}

// The id of the handle that a link enters on a block: its input's, or its
// own on a variadic block.
function inputHandle(board: Board, link: LinkId): string {
  return `in:${board.links[link]?.input ?? ""}#${link}`;
}

// The label of a link into a variadic block that has no name: its place
// among the links into the block, as "Input 2".
function placeLabel(board: Board, link: LinkId): string {
  const to = board.links[link]?.to;
  const into = Object.entries(board.links).filter(([, other]) => other.to === to);
  return `Input ${String(into.findIndex(([id]) => id === link) + 1)}`;
}

// What blockHandles() needs to know of a block and the links drawn.
interface BlockArgs {
  readonly board: Board;
  readonly id: BlockId;
  readonly entry: RegistryEntry | undefined;
  readonly width: number;
  readonly layout: Layout;
  readonly links: readonly DrawnLink[];
  readonly byId: ReadonlyMap<LinkId, DrawnLink>;
  readonly locked: boolean;
}

// The handles of a block's node, each where it sits.
function blockHandles({ board, id, entry, width, layout, links, byId, locked }: BlockArgs): HandleSpec[] {
  const into = Object.entries(board.links).filter(([, link]) => link.to === id);
  const name = (block: BlockId) => board.blocks[block]?.name ?? block;
  const wanted: Omit<HandleSpec, "x" | "y">[] = [];

  if (isVariadic(entry)) {
    for (const [i, [link, { from, input }]] of into.entries()) {
      const label = input === "" ? `Input ${String(i + 1)}` : input;
      wanted.push({
        id: inputHandle(board, link),
        type: "target",
        side: byId.get(link)?.in ?? idleSide(layout, "target"),
        name: label,
        label: `${label}, from ${name(from)}`,
        link,
        connectable: !locked,
      });
    }
    wanted.push({
      id: NEXT,
      type: "target",
      side: idleSide(layout, "target"),
      name: "Next input",
      label: "Next input",
      input: "",
      connectable: !locked,
    });
  } else {
    // The class's inputs, and any input that a link feeds but the class
    // lacks, as where the block registry lacks the class.
    const inputs = [...(entry?.inputs ?? [])];
    for (const [, link] of into) if (!inputs.includes(link.input)) inputs.push(link.input);
    for (const input of inputs) {
      const feeding = into.find(([, link]) => link.input === input);
      wanted.push({
        id: feeding === undefined ? `in:${input}` : inputHandle(board, feeding[0]),
        type: "target",
        side: (feeding === undefined ? undefined : byId.get(feeding[0])?.in) ?? idleSide(layout, "target"),
        name: input,
        label: feeding === undefined ? input : `${input}, from ${name(feeding[1].from)}`,
        ...(feeding === undefined ? {} : { link: feeding[0] }),
        input,
        connectable: !locked,
      });
    }
  }

  const sides = new Set(links.filter((link) => link.from.node === blockNode(id)).map((link) => link.out));
  if (sides.size === 0) sides.add(idleSide(layout, "source"));
  for (const side of SIDES) {
    if (sides.has(side)) wanted.push({ id: `out-${side}`, type: "source", side, name: "Result", label: "Result", connectable: !locked });
  }

  const markLeft = (width - MARK) / 2;
  const lines: Readonly<Record<Side, Line>> = {
    top: { x: width / 2, y: 0, along: "x", most: markLeft + MARK - DOT_ROOM },
    bottom: { x: width / 2, y: BLOCK_HEIGHT, along: "x" },
    left: { x: markLeft, y: MARK / 2, along: "y" },
    right: { x: markLeft + MARK, y: MARK / 2, along: "y", least: DOT_ROOM },
  };
  return spread(wanted, lines, MARK);
}

// The handles of a collapsed stack's box, where the links between its blocks
// and blocks outside it end: on each side that one of them uses, one handle
// for the links into the stack and one for the links out of it.
function stackHandles(box: Box, links: readonly DrawnLink[], node: string): HandleSpec[] {
  const wanted: Omit<HandleSpec, "x" | "y">[] = [];
  for (const side of SIDES) {
    if (links.some((link) => link.to.node === node && link.in === side)) {
      wanted.push({ id: `in-${side}`, type: "target", side, name: "Links in", label: "Links into the stack", connectable: false });
    }
    if (links.some((link) => link.from.node === node && link.out === side)) {
      wanted.push({ id: `out-${side}`, type: "source", side, name: "Links out", label: "Links out of the stack", connectable: false });
    }
  }
  const lines: Readonly<Record<Side, Line>> = {
    top: { x: box.w / 2, y: 0, along: "x" },
    bottom: { x: box.w / 2, y: box.h, along: "x" },
    left: { x: 0, y: box.h / 2, along: "y" },
    right: { x: box.w, y: box.h / 2, along: "y" },
  };
  return spread(wanted, lines, Math.min(box.w, box.h));
}

const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

// The line along which the handles of one side spread: its middle, the axis
// along which it runs, and the least and the most that the middle of a handle
// sits at along it, where something else sits beyond, as the status dot does
// beyond the right end of the mark's top and the top end of its right side.
interface Line {
  readonly x: number;
  readonly y: number;
  readonly along: "x" | "y";
  readonly least?: number;
  readonly most?: number;
}

// The handles, each placed on its side's line: the handles of one side spread
// around the line's middle, in the order given, at least HANDLE_STEP apart,
// and further where the span allows, and move together where the first would
// sit before the line's `least` or the last past its `most`.
function spread(wanted: readonly Omit<HandleSpec, "x" | "y">[], lines: Readonly<Record<Side, Line>>, span: number): HandleSpec[] {
  const placed: HandleSpec[] = [];
  for (const side of SIDES) {
    const handles = wanted.filter((handle) => handle.side === side);
    const step = Math.max(span / (handles.length + 1), HANDLE_STEP);
    const line = lines[side];
    const middle = line.along === "x" ? line.x : line.y;
    const first = middle - ((handles.length - 1) / 2) * step;
    const last = middle + ((handles.length - 1) / 2) * step;
    const on = line.least === undefined ? 0 : Math.max(0, line.least - first);
    const back = line.most === undefined ? 0 : Math.max(0, last - line.most);
    for (const [i, handle] of handles.entries()) {
      const offset = (i - (handles.length - 1) / 2) * step + on - back;
      const x = line.along === "x" ? line.x + offset : line.x;
      const y = line.along === "y" ? line.y + offset : line.y;
      placed.push({ ...handle, x: x - HANDLE / 2, y: y - HANDLE / 2 });
    }
  }
  return placed;
}

const POSITIONS: Readonly<Record<Side, Position>> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

// A handle as React Flow takes it on a node.
function nodeHandle(handle: HandleSpec): NodeHandle {
  return { id: handle.id, type: handle.type, position: POSITIONS[handle.side], x: handle.x, y: handle.y, width: HANDLE, height: HANDLE };
}

export function positionOf(side: Side): Position {
  return POSITIONS[side];
}
