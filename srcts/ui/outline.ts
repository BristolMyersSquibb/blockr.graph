// What the panel of search and the outline lists
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#search-and-the-outline):
//
// - The outline, "Board contents", lists each stack as a row that folds, with
//   its blocks in the order of their links and the number of its blocks, and
//   then the blocks in no stack, in the order of their links too.
// - A query narrows the panel to the stacks and the blocks whose name or id
//   holds it, ignoring case, the stacks first.

import type { BlockId, Board, StackId } from "@blockr/core";
import { stackOf } from "../geometry/index.ts";
import { linkOrder } from "../placement/index.ts";

export interface OutlineStack {
  readonly stack: StackId;
  readonly name: string;
  readonly blocks: readonly OutlineBlock[];
}

export interface OutlineBlock {
  readonly block: BlockId;
  readonly name: string;
  // The stack that holds the block, or null for none.
  readonly stack: StackId | null;
}

export interface Outline {
  readonly stacks: readonly OutlineStack[];
  // The blocks in no stack.
  readonly loose: readonly OutlineBlock[];
}

export function outlineOf(board: Board): Outline {
  const held = stackOf(board);
  const row = (block: BlockId): OutlineBlock => ({ block, name: board.blocks[block]?.name ?? block, stack: held.get(block) ?? null });
  const stacks = Object.entries(board.stacks).map(([stack, { name, blocks }]) => ({
    stack,
    name,
    blocks: linkOrder(board, new Set(blocks.filter((block) => held.get(block) === stack))).map(row),
  }));
  const loose = linkOrder(board, new Set(Object.keys(board.blocks).filter((block) => !held.has(block)))).map(row);
  return { stacks, loose };
}

// What a query matches: the stacks and the blocks whose name or id holds it,
// ignoring case, the stacks first, each in the order of the outline.
export function matching(outline: Outline, query: string): { stacks: OutlineStack[]; blocks: OutlineBlock[] } {
  const wanted = query.trim().toLowerCase();
  const holds = (name: string, id: string) => name.toLowerCase().includes(wanted) || id.toLowerCase().includes(wanted);
  const blocks = [...outline.stacks.flatMap((stack) => stack.blocks), ...outline.loose];
  return {
    stacks: outline.stacks.filter((stack) => holds(stack.name, stack.stack)),
    blocks: blocks.filter((block) => holds(block.name, block.block)),
  };
}
