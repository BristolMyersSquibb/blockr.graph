// Boards for the tests: one built from a short description, and the layered
// boards of the spike that checked making room, with stacks grown from given
// points (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3,
// notes).

import type { BlockId, Board, Link, LinkId, Stack, StackId } from "@blockr/core";
import { defaultState, GRAPH } from "../state/index.ts";
import type { GraphState, Point } from "../state/index.ts";

// A board by its blocks' names, its links as pairs of block ids, its stacks
// as lists of block ids, and the DAG's state, the default where left out.
export interface BoardSpec {
  readonly blocks: Readonly<Record<BlockId, string>>;
  readonly links?: readonly (readonly [BlockId, BlockId])[];
  readonly stacks?: Readonly<Record<StackId, readonly BlockId[]>>;
  readonly state?: Partial<GraphState>;
}

export function boardOf(spec: BoardSpec): Board {
  const blocks = Object.fromEntries(
    Object.entries(spec.blocks).map(([id, name]) => [id, { registry_id: "blockr.core-head_block", state: {}, name, locked: null }]),
  );
  const links: Record<LinkId, Link> = {};
  for (const [i, [from, to]] of (spec.links ?? []).entries()) links[`l${String(i + 1)}`] = { from, to, input: "data" };
  const stacks = Object.fromEntries(
    Object.entries(spec.stacks ?? {}).map(([id, held]) => [id, { name: id, blocks: [...held], color: null }]),
  );
  return { id: "test", name: "Test", blocks, links, stacks, options: {}, plugins: { [GRAPH]: { ...defaultState, ...spec.state } } };
}

// The board with the DAG's state changed as given.
export function withState(board: Board, state: Partial<GraphState>): Board {
  const held = board.plugins[GRAPH] as GraphState;
  return { ...board, plugins: { ...board.plugins, [GRAPH]: { ...held, ...state } } };
}

// The DAG's state on a board that boardOf() made.
export function stateOf(board: Board): GraphState {
  return board.plugins[GRAPH] as GraphState;
}

// A generator of numbers from 0 to 1 that gives the same numbers for the same
// seed.
export function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296;
}

// The shapes of the spike's layered boards: how many ranks, of about how
// many blocks each.
export const SHAPES = {
  wide: { ranks: 5, width: 20 },
  deep: { ranks: 20, width: 4 },
  square: { ranks: 9, width: 9 },
  small: { ranks: 4, width: 3 },
  large: { ranks: 16, width: 18 },
} as const;

// A layered board: `ranks` layers of about `width` blocks, with names of 4 to
// 30 characters, each block reading from one or two blocks of the layer
// above, near its own place in the layer.
export function layeredBoard({ ranks, width, seed }: { ranks: number; width: number; seed: number }): Board {
  const random = lcg(seed);
  const names: Record<BlockId, string> = {};
  const links: [BlockId, BlockId][] = [];
  const layers: BlockId[][] = [];
  let count = 0;
  for (let rank = 0; rank < ranks; rank++) {
    const layer: BlockId[] = [];
    const size = Math.max(1, Math.round(width * (0.7 + 0.6 * random())));
    for (let i = 0; i < size; i++) {
      const id = `b${String(count++)}`;
      names[id] = "x".repeat(4 + Math.floor(random() * 26));
      layer.push(id);
    }
    layers.push(layer);
  }
  for (const [rank, layer] of layers.entries()) {
    const above = layers[rank - 1];
    if (above === undefined) continue;
    for (const [i, id] of layer.entries()) {
      const at = ((i + 0.5) / layer.length) * above.length;
      const reads = random() < 0.35 ? 2 : 1;
      const from = new Set<BlockId>();
      for (let j = 0; j < reads; j++) {
        const k = Math.min(above.length - 1, Math.max(0, Math.floor(at + (random() - 0.5) * 3)));
        const block = above[k];
        if (block !== undefined) from.add(block);
      }
      for (const block of from) links.push([block, id]);
    }
  }
  return boardOf({ blocks: names, links });
}

// Where a stack grows from: a point given as shares of the board's width and
// height, and how many blocks it takes.
export interface StackSpec {
  readonly name: StackId;
  readonly at: readonly [number, number];
  readonly size: number;
}

// The stacks of the spike's boards, by the number of blocks.
export function stackSpecs(blocks: number): StackSpec[] {
  if (blocks < 30) {
    return [
      { name: "centre", at: [0.5, 0.5], size: 4 },
      { name: "corner", at: [0, 0], size: 2 },
      { name: "edge", at: [1, 0.5], size: 2 },
    ];
  }
  return [
    { name: "big", at: [0.5, 0.5], size: Math.min(25, Math.round(blocks / 5)) },
    { name: "mid", at: [0.22, 0.3], size: 8 },
    { name: "corner", at: [0, 0], size: 3 },
    { name: "edge", at: [1, 0.5], size: 5 },
    { name: "pair", at: [0.6, 1], size: 2 },
  ];
}

// The board with a stack grown from each point, from the block nearest the
// point where the blocks sit at the positions, through links, nearest blocks
// first. A stack that finds fewer than two blocks is left out.
export function withStacks(board: Board, specs: readonly StackSpec[], positions: Readonly<Record<BlockId, Point>>): Board {
  const ids = Object.keys(board.blocks);
  const at = (block: BlockId) => positions[block] ?? { x: 0, y: 0 };
  const xs = ids.map((block) => at(block).x);
  const ys = ids.map((block) => at(block).y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const near = new Map(ids.map((block) => [block, new Set<BlockId>()]));
  for (const link of Object.values(board.links)) {
    near.get(link.from)?.add(link.to);
    near.get(link.to)?.add(link.from);
  }
  const taken = new Set<BlockId>();
  const stacks: Record<StackId, Stack> = { ...board.stacks };
  for (const { name, at: [fx, fy], size } of specs) {
    const [tx, ty] = [x0 + fx * (x1 - x0), y0 + fy * (y1 - y0)];
    const far = (block: BlockId) => Math.hypot(at(block).x - tx, at(block).y - ty);
    const [seed] = ids.filter((block) => !taken.has(block)).sort((a, b) => far(a) - far(b));
    if (seed === undefined) continue;
    const group = [seed];
    taken.add(seed);
    while (group.length < size) {
      const next = [...new Set(group.flatMap((block) => [...(near.get(block) ?? [])]))]
        .filter((block) => !taken.has(block))
        .sort((a, b) => far(a) - far(b))[0];
      if (next === undefined) break;
      group.push(next);
      taken.add(next);
    }
    if (group.length >= 2) stacks[name] = { name, blocks: group, color: null };
    else taken.delete(seed);
  }
  return { ...board, stacks };
}
