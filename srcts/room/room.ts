// The three times the DAG makes room, each through the projection of
// ./project.ts, from targets of its own
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#making-room):
//
// - Around a stack that collapses, each node's target closes up on it.
// - Around a stack that expands, each node's target is where it sits, and
//   the stack's box stays where it is, so that what lies in it moves out.
// - For what Repulsion places, each node's target is where it sits, and what
//   the step adds stays where it starts, so that what lies within the gap of
//   it moves off it.
//
// Each gives the changes of the nodes that it moves: the positions of
// blocks, and of stacks that hold no block. A collapsed stack moves as one
// node of its collapsed size, whose blocks move with it by one distance,
// while the blocks of an expanded stack move one by one, as blocks in no
// stack do.

import type { BlockId, StackId } from "@blockr/core";
import { canvasNodes, expandedBox, nodeChanges, shifted, stackBoxAt } from "../geometry/index.ts";
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
  if (full === undefined) return { positions: {}, points: {} };
  const small = stackBoxAt(full);
  const nodes = canvasNodes(canvas).filter((node) => node.stack !== stack);
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

// Expanding the stack, whose blocks sit where they were in it: its box stays
// where it is, and whatever lies in it moves out, taking along the nodes in
// its way.
export function clearBox(canvas: Canvas, stack: StackId, gap: number): Changes {
  const full = expandedBox(canvas, stack);
  if (full === undefined) return { positions: {}, points: {} };
  const nodes = canvasNodes(canvas).filter((node) => node.stack !== stack);
  const bodies = [...nodes.map((node) => bodyOf(node)), fixedBox(full, "inside")];
  return changesOf(canvas, nodes, project(bodies, bodies, gap));
}

// What a step adds, which stays where it starts.
export interface Added {
  readonly blocks: ReadonlySet<BlockId>;
  readonly stacks: ReadonlySet<StackId>;
}

// Making room for what a step adds, as Repulsion places it: what it adds
// stays where it starts, and so does each block that the same step moves, as
// where the assistant moves a block in the edit that adds another beside it.
// The nodes within the gap of what the step adds move off it. Those around a
// block that the step moves keep what they had, since it takes the block's
// place as given.
export function makeRoom(canvas: Canvas, added: Added, moved: ReadonlySet<BlockId>, gap: number): Changes {
  const nodes = canvasNodes(canvas);
  const push = (node: CanvasNode): Push | undefined => {
    if (node.kind === "stack") return added.stacks.has(node.id) ? "all" : undefined;
    if (added.blocks.has(node.id)) return "all";
    return moved.has(node.id) ? "none" : undefined;
  };
  const bodies = nodes.map((node) => bodyOf(node, push(node)));
  return changesOf(canvas, nodes, project(bodies, bodies, gap), (i) => bodies[i]?.fixed !== undefined);
}

function bodyOf(node: CanvasNode, fixed?: Push): Body {
  const holder = node.kind === "block" ? node.stack : null;
  return { ...node.box, holder, ...(fixed === undefined ? {} : { fixed }) };
}

function fixedBox(box: Box, push: Push): Body {
  return { ...box, holder: null, fixed: push };
}

// The changes of the nodes that the places move, in the order of the nodes,
// but for those that `skip` names by their index.
function changesOf(canvas: Canvas, nodes: readonly CanvasNode[], places: readonly Point[], skip?: (i: number) => boolean): Changes {
  const positions: Record<BlockId, Point> = {};
  const points: Record<StackId, Point> = {};
  for (const [i, node] of nodes.entries()) {
    const place = places[i];
    if (place === undefined || skip?.(i) === true) continue;
    const [dx, dy] = [place.x - node.box.x, place.y - node.box.y];
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
