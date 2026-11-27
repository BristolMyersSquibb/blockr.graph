// The four times the DAG makes room, each through the projection of
// ./project.ts, from targets of its own
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#making-room):
//
// - Around a stack that collapses, each node's target closes up on it.
// - Around a stack that expands, each node's target is where it sits, and
//   the stack stays where it is, so that what lies in the padding around one
//   of its blocks moves out.
// - For what Repulsion places, each node's target is where it sits, and what
//   the step adds stays where it starts, so that what lies within the gap of
//   it moves off it.
// - For the stacks whose shapes a step grew or formed, each node's target is
//   where it sits, and each of those stacks stays where it is, so that what
//   lies in the padding around one of its blocks or within the gap of it
//   moves off it.
//
// Each gives the changes of the nodes that it moves: the positions of
// blocks, and of stacks that hold no block. Each stack moves as one, so that
// a stack moves aside as a block does. A collapsed stack, and a stack that
// holds no block, is one node of its box, whose blocks move with it by one
// distance. An expanded stack is a node for each of its blocks, the block's
// box with the padding, which its shape holds (../shape), and those nodes
// move by one distance (./project.ts). So the nodes around an expanded stack
// keep the gap from the padding around its blocks, rather than from its box.
// The blocks of an expanded stack that holds a block that the step adds
// move one by one instead, as blocks in no stack do, so that they make room
// for it.

import type { BlockId, StackId } from "@blockr/core";
import {
  canvasNodes,
  expandedBox,
  NO_CHANGES,
  nodeChanges,
  overlaps,
  padded,
  paddedBoxes,
  shifted,
  shownBox,
  STACK_PADDING,
  stackBoxAt,
} from "../geometry/index.ts";
import type { Box, Canvas, CanvasNode, Changes } from "../geometry/index.ts";
import type { Point } from "../state/index.ts";
import { project } from "./project.ts";
import type { Body, Push } from "./project.ts";

// How far the moves of a collapse reach: σ of the bell, as a multiple of the
// furthest that the box's edge moves.
const SIGMA = 3;

// The least move that counts, in pixels, below which a node stays.
const LEAST = 0.5;

// Collapsing the stack: its box shrinks to its collapsed size, and each node
// around it gets a target that closes up on it.
// The target lies on the line from the stack's centre through the node,
// nearer the centre by a share of how far the box's edge moves along that
// line, exp(-s² / 2σ²). There s is how far the node sits beyond the expanded
// box's edge, and σ is three times the furthest that the box's edge moves,
// or the gap where that is more.
// The collapsed box stays where it is, and keeps what each node had.
export function closeUp(canvas: Canvas, stack: StackId, gap: number): Changes {
  const full = expandedBox(canvas, stack);
  if (full === undefined) return NO_CHANGES;
  const small = stackBoxAt(full);
  const nodes = roomNodes(canvas).filter((node) => node.stack !== stack);
  const spread = Math.max(gap, (SIGMA * Math.max(full.w - small.w, full.h - small.h)) / 2);
  const targets = nodes.map(({ box }): Point => {
    const [vx, vy] = [box.x - full.x, box.y - full.y];
    const length = Math.hypot(vx, vy);
    if (length === 0) return box;
    const [ux, uy] = [vx / length, vy / length];
    const edge = edgeAlong(full, ux, uy);
    const share = Math.exp(-(Math.max(0, length - edge) ** 2) / (2 * spread ** 2));
    const by = (edge - edgeAlong(small, ux, uy)) * share;
    return { x: box.x - ux * by, y: box.y - uy * by };
  });
  const bodies = [...nodes.map((node) => bodyOf(node)), fixedBox(small, "none")];
  return changesOf(canvas, nodes, project(bodies, [...targets, small], gap));
}

// Expanding the stack, whose blocks sit where they were in it: the stack
// stays where it is, and whatever lies in the padding around one of its
// blocks moves out, taking along the nodes in its way.
export function clearBox(canvas: Canvas, stack: StackId, gap: number): Changes {
  const blocks = paddedBoxes(canvas, stack);
  if (blocks.length === 0) return NO_CHANGES;
  const nodes = roomNodes(canvas).filter((node) => node.stack !== stack);
  const fixed = blocks.map((box): Body => ({ ...box, holder: stack, asOne: true, fixed: "inside" }));
  const bodies = [...nodes.map((node) => bodyOf(node)), ...fixed];
  return changesOf(canvas, nodes, project(bodies, bodies, gap));
}

// What a step adds, which stays where it starts.
export interface Added {
  readonly blocks: ReadonlySet<BlockId>;
  readonly stacks: ReadonlySet<StackId>;
}

// Making room for what a step adds, as Repulsion places it: what it adds
// stays where it starts, and so does each block that the same step moves, as
// where the assistant moves a block in the edit that adds another beside it,
// with the stack that holds it. The nodes within the gap of what the step
// adds move off it, a stack as one, so that a block that the step adds in
// the padding around a block of a stack moves the stack aside. Those around
// a block that the step moves keep what they had, since it takes the block's
// place as given.
// An expanded stack that holds a block that the step adds gives its blocks as
// nodes of their own, so that they make room for the block within the stack.
export function makeRoom(canvas: Canvas, added: Added, moved: ReadonlySet<BlockId>, gap: number): Changes {
  const holds = (stack: StackId, of: ReadonlySet<BlockId>) => (canvas.board.stacks[stack]?.blocks ?? []).some((block) => of.has(block));
  const split = new Set(Object.keys(canvas.board.stacks).filter((stack) => !canvas.collapsed.has(stack) && holds(stack, added.blocks)));
  const push = (node: RoomNode): Push | undefined => {
    const stack = asStack(node);
    if (stack !== null) {
      if (added.stacks.has(stack) || holds(stack, added.blocks)) return "all";
      return holds(stack, moved) ? "none" : undefined;
    }
    if (added.blocks.has(node.id)) return "all";
    return moved.has(node.id) ? "none" : undefined;
  };
  return pushing(canvas, roomNodes(canvas, split), push, gap);
}

// Making room for the stacks whose shapes a step grew or formed, once the
// DAG has placed what the step adds: each of them stays where it is, as a
// stack that expands does, and the nodes that lie in the padding around one
// of its blocks or within the gap of it move off it, each stack as one.
// The blocks and the stacks that `kept` names stay where they are, with the
// stacks that hold them, and keep what they had, as what the step adds or
// moves does under Repulsion.
// It moves nothing where no node lies in the padding around a block of one
// of the stacks or within the gap of it, by more than the least move that
// counts.
export function clearStacks(
  canvas: Canvas,
  stacks: ReadonlySet<StackId>,
  kept: { readonly blocks: ReadonlySet<BlockId>; readonly stacks: ReadonlySet<StackId> },
  gap: number,
): Changes {
  const nodes = roomNodes(canvas);
  const holds = (stack: StackId) => (canvas.board.stacks[stack]?.blocks ?? []).some((block) => kept.blocks.has(block));
  const push = (node: RoomNode): Push | undefined => {
    const stack = asStack(node);
    if (stack === null) return kept.blocks.has(node.id) ? "none" : undefined;
    if (stacks.has(stack)) return "all";
    return kept.stacks.has(stack) || holds(stack) ? "none" : undefined;
  };
  const grown = nodes.filter((node) => push(node) === "all").map((node) => node.box);
  const crowded = nodes.some((node) => push(node) === undefined && grown.some((box) => overlaps(node.box, box, gap - LEAST)));
  return crowded ? pushing(canvas, nodes, push, gap) : NO_CHANGES;
}

// The changes of the nodes that move as the fixed nodes push them, from
// where each sits, each fixed node pushing as `push` gives.
function pushing(canvas: Canvas, nodes: readonly RoomNode[], push: (node: RoomNode) => Push | undefined, gap: number): Changes {
  const bodies = nodes.map((node) => bodyOf(node, push(node)));
  return changesOf(canvas, nodes, project(bodies, bodies, gap), (i) => bodies[i]?.fixed !== undefined);
}

// A node that making room moves: a node that the DAG shows, or the box of a
// block of an expanded stack that moves as one, with the padding, where
// `asOne` holds.
interface RoomNode extends CanvasNode {
  readonly asOne: boolean;
}

// The stack that the node moves as one with: the stack of a stack's node, or
// of the box of one of its blocks, or null for a block that moves on its own.
function asStack(node: RoomNode): StackId | null {
  if (node.kind === "stack") return node.id;
  return node.asOne ? node.stack : null;
}

// The nodes that making room moves, each in the order that the board holds
// it: each block in no stack, each block of an expanded stack as the box of
// the block with the padding, all of which move as one, and each collapsed
// stack and each stack that holds no block as one node of its box. An
// expanded stack that `split` names gives its blocks as nodes of their own
// instead, as the DAG shows them, which move one by one.
function roomNodes(canvas: Canvas, split: ReadonlySet<StackId> = new Set()): RoomNode[] {
  const blocks = canvasNodes(canvas).flatMap((node): RoomNode[] => {
    if (node.kind !== "block") return [];
    if (node.stack === null || split.has(node.stack)) return [{ ...node, asOne: false }];
    return [{ ...node, box: padded(node.box, STACK_PADDING), asOne: true }];
  });
  const stacks = Object.keys(canvas.board.stacks).flatMap((stack): RoomNode[] => {
    if (!canvas.collapsed.has(stack) && canvas.points[stack] === undefined) return [];
    const box = shownBox(canvas, stack);
    return box === undefined ? [] : [{ kind: "stack", id: stack, box, stack, asOne: false }];
  });
  return [...blocks, ...stacks];
}

function bodyOf(node: RoomNode, fixed?: Push): Body {
  const holder = node.kind === "block" ? node.stack : null;
  return { ...node.box, holder, ...(node.asOne ? { asOne: true } : {}), ...(fixed === undefined ? {} : { fixed }) };
}

function fixedBox(box: Box, push: Push): Body {
  return { ...box, holder: null, fixed: push };
}

// The changes of the nodes that the places move, in the order of the nodes,
// but for those that `skip` names by their index. The blocks of a stack that
// moves as one all move as its first block moves, which they move with.
function changesOf(canvas: Canvas, nodes: readonly RoomNode[], places: readonly Point[], skip?: (i: number) => boolean): Changes {
  const positions: Record<BlockId, Point> = {};
  const points: Record<StackId, Point> = {};
  const moves = new Map<StackId, Point>();
  for (const [i, node] of nodes.entries()) {
    const place = places[i];
    if (place === undefined || skip?.(i) === true) continue;
    const stack = node.kind === "block" ? asStack(node) : null;
    const first = stack === null ? undefined : moves.get(stack);
    const [dx, dy] = first === undefined ? [place.x - node.box.x, place.y - node.box.y] : [first.x, first.y];
    if (stack !== null && first === undefined) moves.set(stack, { x: dx, y: dy });
    if (Math.hypot(dx, dy) < LEAST) continue;
    const changes = nodeChanges(canvas, node, shifted(node.box, dx, dy));
    Object.assign(positions, changes.positions);
    Object.assign(points, changes.points);
  }
  return { positions, points };
}

// How far it is from a box's centre to its edge, along the direction of the
// unit vector (ux, uy).
function edgeAlong(box: Box, ux: number, uy: number): number {
  const across = Math.abs(ux) > 1e-9 ? box.w / 2 / Math.abs(ux) : Infinity;
  const down = Math.abs(uy) > 1e-9 ? box.h / 2 / Math.abs(uy) : Infinity;
  return Math.min(across, down);
}
