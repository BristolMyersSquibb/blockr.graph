// Laying the whole board out with dagre
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#laying-the-board-out-again):
//
// - Each block is a node of its nominal size, and each stack a cluster that
//   holds its blocks.
// - A stack that holds no block is one node of its box's size.
// - A collapsed stack is one node of its collapsed size. Its hidden blocks
//   move with it and keep their places in the stack, so that the board stays
//   compact while the stack is collapsed, and expanding it makes room later.
//   Where some of its blocks have no position, as on a board that opens
//   without positions, the stack is laid out as a cluster, so that its
//   blocks get their places in it.
//
// The result of dagre depends on the order in which it is given nodes and
// edges, so it is given the stacks, the blocks and the links in the order
// that the board holds them, and the same board gives the same positions
// wherever the DAG runs.
// The DAG draws a stack's box around its blocks with STACK_PADDING, which
// lies within the box that dagre gives the cluster, so the spacing needs no
// tuning around a padding that dagre does not know.

import type { BlockId, StackId } from "@blockr/core";
import type { EdgeLabel, GraphLabel, NodeLabel } from "@dagrejs/dagre";
import { BLOCK_HEIGHT, blockWidth, expandedBox, gapOf, STACK_HEIGHT, STACK_WIDTH, stackOf } from "../geometry/index.ts";
import type { Canvas, Changes } from "../geometry/index.ts";
import type { Layout, Point } from "../state/index.ts";
import type { Dagre } from "./load.ts";

// What a layout takes from the DAG's layout.
export type Settings = Pick<Layout, "direction" | "spacing">;

// The positions of every block of the board, and of every stack that holds
// no block, as dagre lays the board out with the settings.
export function layOut(dagre: Dagre, canvas: Canvas, settings: Settings): Changes {
  const { board } = canvas;
  const gap = gapOf(settings.spacing);
  const graph = new dagre.graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>({ compound: true, multigraph: true });
  graph.setGraph({ rankdir: settings.direction, nodesep: gap, ranksep: gap, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));

  // The collapsed stacks that dagre lays out as one node each.
  const folded = new Set(
    [...canvas.collapsed].filter((stack) =>
      (board.stacks[stack]?.blocks ?? []).every((block) => canvas.positions[block] !== undefined),
    ),
  );
  const held = stackOf(board);
  const nodeOf = (block: BlockId): string => {
    const stack = held.get(block);
    return stack !== undefined && folded.has(stack) ? stackNode(stack) : blockNode(block);
  };

  for (const [id, stack] of Object.entries(board.stacks)) {
    const one = folded.has(id) || stack.blocks.length === 0;
    graph.setNode(stackNode(id), one ? { width: STACK_WIDTH, height: STACK_HEIGHT } : { width: 0, height: 0 });
  }
  for (const [id, block] of Object.entries(board.blocks)) {
    const stack = held.get(id);
    if (stack !== undefined && folded.has(stack)) continue;
    graph.setNode(blockNode(id), { width: blockWidth(block.name), height: BLOCK_HEIGHT });
    if (stack !== undefined) graph.setParent(blockNode(id), stackNode(stack));
  }
  for (const [id, link] of Object.entries(board.links)) {
    const [from, to] = [nodeOf(link.from), nodeOf(link.to)];
    if (from !== to && graph.hasNode(from) && graph.hasNode(to)) graph.setEdge(from, to, {}, id);
  }

  dagre.layout(graph);

  const positions: Record<BlockId, Point> = {};
  const points: Record<StackId, Point> = {};
  for (const id of Object.keys(board.blocks)) {
    if (nodeOf(id) !== blockNode(id)) continue;
    const node = graph.node(blockNode(id));
    positions[id] = { x: node.x ?? 0, y: node.y ?? 0 };
  }
  for (const [id, stack] of Object.entries(board.stacks)) {
    const node = graph.node(stackNode(id));
    if (stack.blocks.length === 0) {
      points[id] = { x: node.x ?? 0, y: node.y ?? 0 };
      continue;
    }
    const box = folded.has(id) ? expandedBox(canvas, id) : undefined;
    if (box === undefined) continue;
    const [dx, dy] = [(node.x ?? 0) - box.x, (node.y ?? 0) - box.y];
    for (const block of stack.blocks) {
      const point = canvas.positions[block];
      if (point !== undefined) positions[block] = { x: point.x + dx, y: point.y + dy };
    }
  }
  return { positions, points };
}

// The ids of dagre's nodes, apart for blocks and stacks, since an id is
// unique only within its collection.
function blockNode(block: BlockId): string {
  return `block:${block}`;
}

function stackNode(stack: StackId): string {
  return `stack:${stack}`;
}
